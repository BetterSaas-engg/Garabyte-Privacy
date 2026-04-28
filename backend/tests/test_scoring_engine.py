"""
Scoring engine — critical-path tests covering correctness invariants
the audit explicitly named (C4 partial-completion confidence, M14
skip handling, M16 banker's rounding, compound-rule firing).
"""
from pathlib import Path

import pytest

from app.services.rules_loader import load_rules_library
from app.services.scoring import (
    COMPOUND_DIMENSION_ID,
    _evaluate_compound_rules,
    score_assessment,
)


@pytest.fixture(scope="module")
def rules():
    return load_rules_library(Path(__file__).resolve().parent.parent.parent / "rules")


def _full_pattern(rules, score: int) -> dict[str, int]:
    return {q.id: score for d in rules.dimensions for q in d.questions}


# -- C4 confidence + partial completion -----------------------------------


def test_c4_full_completion_yields_high_confidence(rules):
    """All dimensions answered → all confidence == 'high', coverage 1.0."""
    result = score_assessment(rules, _full_pattern(rules, 3))
    assert all(d.confidence == "high" for d in result.dimension_scores)
    assert result.coverage == 1.0


def test_c4_skipped_dimension_excluded_from_overall(rules):
    """A no-data dimension drops its weight from the overall score."""
    pattern = _full_pattern(rules, 3)
    # Strip every d8 question — d8 is now no-data.
    d8 = next(d for d in rules.dimensions if d.id == "d8")
    for q in d8.questions:
        del pattern[q.id]
    result = score_assessment(rules, pattern)
    d8_score = next(s for s in result.dimension_scores if s.dimension_id == "d8")
    assert d8_score.confidence == "none"
    # Overall should still be ~3.0 (d8 excluded), not dragged down by 0.
    assert result.overall_score > 2.5
    assert result.coverage < 1.0


def test_c4_no_findings_for_no_data_dimensions(rules):
    """Per-dimension findings don't fire on no-data dimensions."""
    pattern = _full_pattern(rules, 3)
    d8 = next(d for d in rules.dimensions if d.id == "d8")
    for q in d8.questions:
        del pattern[q.id]
    result = score_assessment(rules, pattern)
    assert all(g.dimension_id != "d8" for g in result.gaps)


# -- M16 half-up rounding -------------------------------------------------


def test_m16_score_2_5_rounds_up_to_managed(rules):
    """2.5 should label as the level-3 maturity, not the banker's-round level-2."""
    # All-2.5 isn't reachable directly (questions are int 0-4) — fake a
    # dimension score by hand via the helper.
    from app.services.scoring import _score_to_label

    label_at_2_5 = _score_to_label(2.5, rules.dimensions[0].maturity_levels)
    label_at_3_0 = _score_to_label(3.0, rules.dimensions[0].maturity_levels)
    assert label_at_2_5 == label_at_3_0  # half-up: 2.5 rounds to 3, same label


# -- M17 bool-as-int rejection --------------------------------------------


def test_m17_bool_response_rejected(rules):
    """True/False as scores would coerce to 1/0 silently without the guard."""
    pattern = _full_pattern(rules, 2)
    pattern[next(iter(pattern))] = True  # type: ignore
    with pytest.raises(ValueError, match="must be int"):
        score_assessment(rules, pattern)


# -- Compound rules --------------------------------------------------------


def test_compound_rules_load_with_unique_ids(rules):
    """compound_rules.yaml authored 6 unique-id rules referencing real dims."""
    assert len(rules.compound_rules) >= 6
    ids = [r.id for r in rules.compound_rules]
    assert len(ids) == len(set(ids))
    known = {d.id for d in rules.dimensions}
    for r in rules.compound_rules:
        for c in r.conditions:
            assert c.dimension in known


def test_compound_unbounded_condition_rejected_at_load():
    """A condition with no score_min/score_max must fail at __post_init__."""
    from app.services.rules_loader import CompoundCondition

    with pytest.raises(ValueError, match="no bounds"):
        CompoundCondition(dimension="d2")


def test_c1_blind_deletion_fires_when_d2_and_d4_low(rules):
    """c1 fires only when both d2 ≤ 1.5 AND d4 ≤ 2.0."""
    by_id = {f"d{i}": 2.5 for i in range(1, 9)}
    by_id["d2"] = 1.0
    by_id["d4"] = 1.5
    findings = _evaluate_compound_rules(rules.compound_rules, by_id, set())
    fired = {f.dimension_name for f in findings}
    assert "c1_blind_deletion" in fired


def test_c1_blind_deletion_does_not_fire_when_d4_strong(rules):
    """If d4 is healthy, c1 should not fire even if d2 is low."""
    by_id = {f"d{i}": 2.5 for i in range(1, 9)}
    by_id["d2"] = 1.0
    by_id["d4"] = 3.5  # well above the 2.0 ceiling
    findings = _evaluate_compound_rules(rules.compound_rules, by_id, set())
    assert "c1_blind_deletion" not in {f.dimension_name for f in findings}


def test_compound_skip_guard_blocks_no_data_dimensions(rules):
    """A rule whose condition references a no-data dim must NOT fire."""
    by_id = {f"d{i}": 2.5 for i in range(1, 9)}
    by_id["d2"] = 1.0
    by_id["d4"] = 1.5  # would fire c1
    findings = _evaluate_compound_rules(
        rules.compound_rules, by_id, skipped_dim_ids={"d2"},
    )
    assert "c1_blind_deletion" not in {f.dimension_name for f in findings}


def test_compound_findings_use_sentinel_dimension_id(rules):
    """All compound findings carry dimension_id='compound' for the UI panel."""
    by_id = {f"d{i}": 2.5 for i in range(1, 9)}
    by_id["d2"] = 1.0
    by_id["d4"] = 1.0
    by_id["d1"] = 1.0
    findings = _evaluate_compound_rules(rules.compound_rules, by_id, set())
    assert findings, "expected at least one rule to fire"
    assert all(f.dimension_id == COMPOUND_DIMENSION_ID for f in findings)
