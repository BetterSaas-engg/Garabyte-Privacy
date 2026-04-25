"""
Scoring engine.

Takes a set of responses (question_id -> score 0-4) and computes:
- Per-dimension scores (weighted average of question scores within that dimension)
- Overall maturity score (weighted average of dimension scores)
- Gap findings (dimensions whose score matches a remediation trigger fire findings)

Design by contract:
- Preconditions: responses must only contain known question IDs with int values 0-4
- Postconditions: all scores in [0, 4]; every gap has non-empty severity and finding
- Fails fast on unknown question IDs or out-of-range values
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Any

from .rules_loader import RulesLibrary, Dimension, MaturityLevel


@dataclass
class DimensionScore:
    dimension_id: str
    dimension_name: str
    score: float
    maturity_label: str
    weight: float
    question_count: int
    answered_count: int
    # Confidence in this dimension's score, derived from answered ratio:
    #   "high"   -> >= 80% of questions answered
    #   "low"    -> 40-80% answered
    #   "none"   -> <40% answered (treat as no usable signal)
    # The score and maturity_label are still populated when confidence is
    # "low" or "none" so the engine output stays internally consistent, but
    # the UI / overall score should treat "none" as "no data" rather than
    # "Ad hoc". See C4 / M14 in the audit.
    confidence: str = "high"


def _confidence_for(answered: int, total: int) -> str:
    """Map answered/total ratio to a discrete confidence tier."""
    if total <= 0:
        return "none"
    ratio = answered / total
    if ratio >= 0.8:
        return "high"
    if ratio >= 0.4:
        return "low"
    return "none"


@dataclass
class GapFinding:
    dimension_id: str
    dimension_name: str
    severity: str
    finding: str
    recommendation: str
    regulatory_risk: str | None
    typical_consulting_hours: int | None
    upsell_hook: str | None
    score: float


@dataclass
class AssessmentResult:
    overall_score: float
    overall_maturity_label: str
    dimension_scores: list[DimensionScore]
    gaps: list[GapFinding]
    # Coverage = (dimensions with confidence != "none") / (total dimensions).
    # 1.0 means every dimension produced a usable score; values below 1.0
    # mean the overall score is computed over a partial set. The UI should
    # surface this so consultants don't read a partial overall as final.
    coverage: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": round(self.overall_score, 2),
            "overall_maturity_label": self.overall_maturity_label,
            "coverage": round(self.coverage, 2),
            "dimension_scores": [asdict(ds) for ds in self.dimension_scores],
            "gaps": [asdict(g) for g in self.gaps],
        }


def _score_to_label(score: float, maturity_levels: list[MaturityLevel]) -> str:
    """
    Map a continuous score in [0, 4] to its nearest maturity label, looking
    up the label from the dimension's own maturity_levels (so dimension-
    specific rewordings flow through to the score). The YAML files are the
    source of truth for label text -- this function never hardcodes labels.

    Uses half-up rounding (math.floor(score + 0.5)) rather than Python's
    built-in round(), which is banker's rounding (rounds .5 to nearest even
    -- so round(0.5) == 0 and round(2.5) == 2). Half-up is what consultants
    and customers expect; predictability beats statistical neutrality here.

    Note: there is a known label/trigger boundary disagreement at score 1.5
    (label says "Defined" but the YAML triggers fire the Developing-tier
    remediation for the range 1.5 <= avg_score < 2.5). Resolving that is a
    content decision for Garabyte -- see M16 in the audit.
    """
    rounded = max(0, min(4, math.floor(score + 0.5)))
    by_level = {ml.level: ml.label for ml in maturity_levels}
    if rounded not in by_level:
        raise ValueError(
            f"Maturity level {rounded} missing from dimension's maturity_levels"
        )
    return by_level[rounded]


def _score_dimension(dimension: Dimension, responses: dict[str, int]) -> DimensionScore:
    """
    Weighted average of question scores for one dimension.

    If some questions are unanswered, we only average over the answered ones
    (weights are renormalized to the subset). If zero questions are answered,
    the dimension scores 0.0 -- a blank section reads as "Ad hoc", not "missing".
    """
    answered = [
        (q, responses[q.id]) for q in dimension.questions if q.id in responses
    ]

    question_count = len(dimension.questions)
    answered_count = len(answered)
    confidence = _confidence_for(answered_count, question_count)

    if not answered:
        return DimensionScore(
            dimension_id=dimension.id,
            dimension_name=dimension.name,
            score=0.0,
            maturity_label=_score_to_label(0.0, dimension.maturity_levels),
            weight=dimension.weight,
            question_count=question_count,
            answered_count=0,
            confidence=confidence,
        )

    total_weight = sum(q.weight for q, _ in answered)
    weighted_sum = sum(q.weight * score for q, score in answered)
    dim_score = weighted_sum / total_weight if total_weight > 0 else 0.0

    return DimensionScore(
        dimension_id=dimension.id,
        dimension_name=dimension.name,
        score=dim_score,
        maturity_label=_score_to_label(dim_score, dimension.maturity_levels),
        weight=dimension.weight,
        question_count=question_count,
        answered_count=answered_count,
        confidence=confidence,
    )


def _generate_gaps(dimension: Dimension, dim_score: float) -> list[GapFinding]:
    """
    Evaluate all remediation triggers for this dimension against its score.
    Each matching trigger produces one GapFinding.
    """
    findings: list[GapFinding] = []
    for rem in dimension.gap_remediation_library:
        if rem.matches(dim_score):
            findings.append(
                GapFinding(
                    dimension_id=dimension.id,
                    dimension_name=dimension.name,
                    severity=rem.severity,
                    finding=rem.finding,
                    recommendation=rem.recommendation,
                    regulatory_risk=rem.regulatory_risk,
                    typical_consulting_hours=rem.typical_consulting_hours,
                    upsell_hook=rem.upsell_hook,
                    score=dim_score,
                )
            )
    return findings


def score_assessment(
    rules: RulesLibrary,
    responses: dict[str, int],
) -> AssessmentResult:
    """
    Main entry point. Given the rules library and a set of responses,
    return an AssessmentResult with dimension scores, overall score, and gaps.

    Raises ValueError if any response uses an unknown question ID
    or a value outside [0, 4].
    """
    # Contract check -- fail fast on bad inputs
    known_question_ids = {
        q.id for d in rules.dimensions for q in d.questions
    }
    for qid, val in responses.items():
        if qid not in known_question_ids:
            raise ValueError(f"Unknown question ID: {qid}")
        # bool is a subclass of int in Python -- without the explicit bool
        # check, True/False would silently coerce to 1/0.
        if isinstance(val, bool) or not isinstance(val, int) or val < 0 or val > 4:
            raise ValueError(
                f"Response for {qid} must be int 0-4, got {val!r}"
            )

    dim_scores: list[DimensionScore] = []
    all_gaps: list[GapFinding] = []

    for dim in rules.dimensions:
        ds = _score_dimension(dim, responses)
        dim_scores.append(ds)
        # Skip findings for "none"-confidence dimensions: firing remediation
        # off too little data produces wrong gap labels (the partial-completion
        # bug from C4). The UI should show "not enough data" for these.
        if ds.confidence != "none":
            all_gaps.extend(_generate_gaps(dim, ds.score))

    # Overall score is the weighted mean of dimensions with usable data.
    # Skipped / barely-answered dimensions are excluded so a partial assessment
    # doesn't drag the overall score down as if the customer reported "Ad hoc"
    # for missing dimensions. Weights are renormalized over the included subset.
    confident_dims = [ds for ds in dim_scores if ds.confidence != "none"]
    if confident_dims:
        included_weight = sum(ds.weight for ds in confident_dims)
        overall = sum(ds.score * ds.weight for ds in confident_dims) / included_weight
    else:
        overall = 0.0

    coverage = len(confident_dims) / len(dim_scores) if dim_scores else 0.0

    # Sort gaps by severity (critical first), then by lowest score
    severity_rank = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    all_gaps.sort(key=lambda g: (severity_rank.get(g.severity, 99), g.score))

    # Use the first dimension's maturity_levels for the overall label.
    # RulesLibrary.validate() enforces that all dimensions agree on labels,
    # so any dimension would give the same answer here.
    overall_levels = rules.dimensions[0].maturity_levels

    return AssessmentResult(
        overall_score=overall,
        overall_maturity_label=_score_to_label(overall, overall_levels),
        dimension_scores=dim_scores,
        gaps=all_gaps,
        coverage=coverage,
    )
