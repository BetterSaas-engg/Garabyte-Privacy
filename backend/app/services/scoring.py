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

from dataclasses import dataclass, field, asdict
from typing import Any
import re

from .rules_loader import RulesLibrary, Dimension


@dataclass
class DimensionScore:
    dimension_id: str
    dimension_name: str
    score: float
    maturity_label: str
    weight: float
    question_count: int
    answered_count: int


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

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": round(self.overall_score, 2),
            "overall_maturity_label": self.overall_maturity_label,
            "dimension_scores": [asdict(ds) for ds in self.dimension_scores],
            "gaps": [asdict(g) for g in self.gaps],
        }


# Maturity labels matching the YAML files
_MATURITY_LABELS = {
    0: "Ad hoc",
    1: "Developing",
    2: "Defined",
    3: "Managed",
    4: "Optimized",
}


def _score_to_label(score: float) -> str:
    """Map a continuous score in [0, 4] to its nearest maturity label."""
    rounded = max(0, min(4, round(score)))
    return _MATURITY_LABELS[rounded]


def _evaluate_trigger(trigger: str, avg_score: float) -> bool:
    """
    Evaluate a trigger condition like 'avg_score < 1.5' or '1.5 <= avg_score < 2.5'.

    Hand-rolled parser -- we do NOT use Python's eval() because that would execute
    arbitrary code if a YAML file were compromised. Only accepts the specific
    comparison patterns we use.

    Supported forms:
      avg_score < X
      avg_score <= X
      avg_score > X
      avg_score >= X
      X <= avg_score < Y
      X < avg_score <= Y
      X <= avg_score <= Y
      X < avg_score < Y

    Unknown forms return False (fail-safe: no match = no finding fires).
    """
    t = trigger.strip()
    if not t:
        return False

    # Single-ended: "avg_score OP X"
    m = re.fullmatch(r"avg_score\s*(<|<=|>|>=)\s*([0-9.]+)", t)
    if m:
        op, rhs = m.group(1), float(m.group(2))
        if op == "<": return avg_score < rhs
        if op == "<=": return avg_score <= rhs
        if op == ">": return avg_score > rhs
        if op == ">=": return avg_score >= rhs

    # Double-ended: "X OP_LO avg_score OP_HI Y"
    m = re.fullmatch(
        r"([0-9.]+)\s*(<|<=)\s*avg_score\s*(<|<=)\s*([0-9.]+)", t
    )
    if m:
        lo = float(m.group(1))
        op_lo = m.group(2)
        op_hi = m.group(3)
        hi = float(m.group(4))
        lo_ok = (avg_score >= lo) if op_lo == "<=" else (avg_score > lo)
        hi_ok = (avg_score <= hi) if op_hi == "<=" else (avg_score < hi)
        return lo_ok and hi_ok

    # Unknown syntax -- fail safe
    return False


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

    if not answered:
        return DimensionScore(
            dimension_id=dimension.id,
            dimension_name=dimension.name,
            score=0.0,
            maturity_label="Ad hoc",
            weight=dimension.weight,
            question_count=len(dimension.questions),
            answered_count=0,
        )

    total_weight = sum(q.weight for q, _ in answered)
    weighted_sum = sum(q.weight * score for q, score in answered)
    dim_score = weighted_sum / total_weight if total_weight > 0 else 0.0

    return DimensionScore(
        dimension_id=dimension.id,
        dimension_name=dimension.name,
        score=dim_score,
        maturity_label=_score_to_label(dim_score),
        weight=dimension.weight,
        question_count=len(dimension.questions),
        answered_count=len(answered),
    )


def _generate_gaps(dimension: Dimension, dim_score: float) -> list[GapFinding]:
    """
    Evaluate all remediation triggers for this dimension against its score.
    Each matching trigger produces one GapFinding.
    """
    findings: list[GapFinding] = []
    for rem in dimension.gap_remediation_library:
        if _evaluate_trigger(rem.trigger_condition, dim_score):
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
        if not isinstance(val, int) or val < 0 or val > 4:
            raise ValueError(
                f"Response for {qid} must be int 0-4, got {val!r}"
            )

    dim_scores: list[DimensionScore] = []
    all_gaps: list[GapFinding] = []

    for dim in rules.dimensions:
        ds = _score_dimension(dim, responses)
        dim_scores.append(ds)
        all_gaps.extend(_generate_gaps(dim, ds.score))

    # Overall = weighted mean of dimension scores
    total_weight = sum(d.weight for d in rules.dimensions)
    overall = sum(ds.score * ds.weight for ds in dim_scores) / total_weight

    # Sort gaps by severity (critical first), then by lowest score
    severity_rank = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    all_gaps.sort(key=lambda g: (severity_rank.get(g.severity, 99), g.score))

    return AssessmentResult(
        overall_score=overall,
        overall_maturity_label=_score_to_label(overall),
        dimension_scores=dim_scores,
        gaps=all_gaps,
    )
