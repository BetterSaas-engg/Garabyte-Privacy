"""
Rules library loader.

Reads all YAML files in the rules/ directory and produces a single
validated in-memory representation used by the scoring engine.

Design principles:
- Single source of truth: the YAML files are authoritative; code only reads them.
- Fail fast: malformed YAML or missing required fields raise on load,
  not at request time.
- Orthogonal: rules loading is independent of scoring, DB, API, and frontend.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class QuestionOption:
    """A single answer option for a question. value is the 0-4 maturity score."""
    value: int
    label: str


@dataclass
class Question:
    """One question within a dimension."""
    id: str
    text: str
    weight: float  # weight within its dimension, 0-1
    options: list[QuestionOption] = field(default_factory=list)
    evidence_prompt: str | None = None
    regulatory_note: str | None = None


@dataclass
class GapRemediation:
    """
    A remediation entry that fires when a dimension's score falls in a range.

    Trigger semantics: fires when (score_min is None or score >= score_min)
    AND (score_max is None or score < score_max), with min/max inclusivity
    controlled by the *_inclusive flags. Defaults match the original YAML
    convention: low side inclusive, high side exclusive.
    """
    severity: str  # "critical" | "high" | "moderate" | "low"
    finding: str
    recommendation: str
    score_min: float | None = None
    score_max: float | None = None
    min_inclusive: bool = True
    max_inclusive: bool = False
    regulatory_risk: str | None = None
    typical_consulting_hours: int | None = None
    upsell_hook: str | None = None

    def matches(self, score: float) -> bool:
        """Does this remediation fire for the given dimension score?"""
        if self.score_min is not None:
            if self.min_inclusive:
                if score < self.score_min:
                    return False
            else:
                if score <= self.score_min:
                    return False
        if self.score_max is not None:
            if self.max_inclusive:
                if score > self.score_max:
                    return False
            else:
                if score >= self.score_max:
                    return False
        return True


@dataclass
class RegulatoryAnchor:
    """A regulation this dimension maps to, with specific clauses."""
    regulation: str
    clauses: list[str]


@dataclass
class MaturityLevel:
    """One of the 5 levels (0-4) describing program maturity."""
    level: int
    label: str
    description: str


@dataclass
class Dimension:
    """One of the 8 privacy program dimensions."""
    id: str
    name: str
    weight: float  # weight across dimensions; all 8 should sum to 1.0
    description: str
    regulatory_anchors: list[RegulatoryAnchor] = field(default_factory=list)
    maturity_levels: list[MaturityLevel] = field(default_factory=list)
    questions: list[Question] = field(default_factory=list)
    gap_remediation_library: list[GapRemediation] = field(default_factory=list)


@dataclass
class RulesLibrary:
    """The complete rules library ��� all 8 dimensions plus validation."""
    dimensions: list[Dimension]
    # Short stable identifier for the loaded YAML content. Used to stamp
    # AssessmentResult so a stored report can be traced to the rules version
    # in effect when it was scored. Computed at load time as sha256(concat
    # YAML file contents) truncated to 12 hex chars. Coarse but reliable --
    # any change to a YAML (including comments) bumps the version.
    version: str = "unknown"

    def by_id(self, dimension_id: str) -> Dimension:
        """Find a dimension by its id (e.g. 'd1'). Raises KeyError if missing."""
        for d in self.dimensions:
            if d.id == dimension_id:
                return d
        raise KeyError(f"Unknown dimension: {dimension_id}")

    def validate(self) -> None:
        """
        Verify invariants. Called at load time. Raises ValueError on any issue.

        Invariants enforced:
        - Library is not empty
        - Dimension weights sum to 1.0 (with small floating-point tolerance)
        - Every dimension has at least one question
        - Each dimension's question weights sum to 1.0
        - Every question has at least one option
        - Every dimension defines all 5 maturity levels (0-4)
        - All dimensions agree on the maturity label text (so the engine has
          a single source of truth for "what does score 2 look like")
        """
        if not self.dimensions:
            raise ValueError("Rules library is empty")

        weight_sum = sum(d.weight for d in self.dimensions)
        if abs(weight_sum - 1.0) > 0.001:
            raise ValueError(
                f"Dimension weights must sum to 1.0, got {weight_sum}"
            )

        for d in self.dimensions:
            if not d.questions:
                raise ValueError(f"Dimension {d.id} has no questions")

            q_sum = sum(q.weight for q in d.questions)
            if abs(q_sum - 1.0) > 0.01:
                raise ValueError(
                    f"Dimension {d.id} question weights must sum to 1.0, got {q_sum}"
                )

            for q in d.questions:
                if not q.options:
                    raise ValueError(
                        f"Question {q.id} in {d.id} has no options"
                    )

            # Each dimension must define all 5 maturity levels.
            level_keys = sorted(ml.level for ml in d.maturity_levels)
            if level_keys != [0, 1, 2, 3, 4]:
                raise ValueError(
                    f"Dimension {d.id} maturity_levels must define exactly "
                    f"levels 0-4, got {level_keys}"
                )

        # All dimensions must use the same label text per level. Drift
        # between dimensions would let the engine produce inconsistent
        # overall vs per-dimension labels.
        canonical = {ml.level: ml.label for ml in self.dimensions[0].maturity_levels}
        for d in self.dimensions[1:]:
            for ml in d.maturity_levels:
                if canonical.get(ml.level) != ml.label:
                    raise ValueError(
                        f"Dimension {d.id} maturity_levels disagree with "
                        f"{self.dimensions[0].id}: level {ml.level} is "
                        f"{ml.label!r} here vs {canonical.get(ml.level)!r} there"
                    )


# ---- Parsers: convert YAML dicts to dataclass instances ----


def _parse_question(raw: dict[str, Any]) -> Question:
    options = [
        QuestionOption(value=opt["value"], label=opt["label"])
        for opt in raw.get("options", [])
    ]
    return Question(
        id=raw["id"],
        text=raw["text"],
        weight=float(raw.get("weight", 0.2)),
        options=options,
        evidence_prompt=raw.get("evidence_prompt"),
        regulatory_note=raw.get("regulatory_note"),
    )


def _parse_gap_remediation(raw: dict[str, Any]) -> GapRemediation:
    if "trigger_condition" in raw or "trigger" in raw:
        raise ValueError(
            "trigger_condition string format is no longer supported. "
            "Use structured score_min / score_max fields instead "
            "(see rules_loader.GapRemediation docstring)."
        )

    score_min = raw.get("score_min")
    score_max = raw.get("score_max")
    if score_min is None and score_max is None:
        raise ValueError(
            f"Gap remediation must specify at least one of score_min / "
            f"score_max (rule: {raw.get('finding', '<unnamed>')!r})"
        )

    return GapRemediation(
        severity=raw.get("severity", "moderate"),
        finding=raw.get("finding", ""),
        recommendation=raw.get("recommendation", ""),
        score_min=float(score_min) if score_min is not None else None,
        score_max=float(score_max) if score_max is not None else None,
        min_inclusive=bool(raw.get("min_inclusive", True)),
        max_inclusive=bool(raw.get("max_inclusive", False)),
        regulatory_risk=raw.get("regulatory_risk"),
        typical_consulting_hours=(
            raw.get("typical_consulting_hours") or raw.get("hours")
        ),
        upsell_hook=raw.get("upsell_hook"),
    )


def _parse_dimension(raw: dict[str, Any]) -> Dimension:
    regulatory_anchors = [
        RegulatoryAnchor(
            regulation=ra["regulation"],
            clauses=ra.get("clauses", []),
        )
        for ra in raw.get("regulatory_anchors", [])
    ]

    maturity_levels = []
    for level_key, level_val in (raw.get("maturity_levels") or {}).items():
        maturity_levels.append(
            MaturityLevel(
                level=int(level_key),
                label=level_val["label"],
                description=level_val["description"],
            )
        )

    questions = [_parse_question(q) for q in raw.get("questions", [])]

    gap_remediation = [
        _parse_gap_remediation(g)
        for g in raw.get("gap_remediation_library", [])
    ]

    return Dimension(
        id=raw["dimension_id"],
        name=raw["dimension_name"],
        weight=float(raw.get("dimension_weight", 0.125)),
        description=raw.get("description", ""),
        regulatory_anchors=regulatory_anchors,
        maturity_levels=maturity_levels,
        questions=questions,
        gap_remediation_library=gap_remediation,
    )


# ---- Public entry point ----


def load_rules_library(rules_dir: Path | str) -> RulesLibrary:
    """
    Load all YAML files in rules_dir, parse them, validate, and return a RulesLibrary.

    Raises:
        FileNotFoundError: if rules_dir does not exist
        ValueError: if any dimension fails validation (bad weights, missing fields)
        yaml.YAMLError: if any file is malformed YAML
    """
    rules_path = Path(rules_dir)
    if not rules_path.exists():
        raise FileNotFoundError(f"Rules directory not found: {rules_path}")

    all_dimensions: list[Dimension] = []
    yaml_files = sorted(rules_path.glob("*.yaml"))

    if not yaml_files:
        raise FileNotFoundError(
            f"No .yaml files found in {rules_path}"
        )

    # Hash the raw YAML bytes (in alphabetical filename order) to produce a
    # stable rules version. Any edit to any YAML -- including comments --
    # bumps the hash, which is the right grain for "did the rules change."
    hasher = hashlib.sha256()
    for yaml_file in yaml_files:
        hasher.update(yaml_file.name.encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(yaml_file.read_bytes())
        hasher.update(b"\0")
    version = hasher.hexdigest()[:12]

    for yaml_file in yaml_files:
        with open(yaml_file, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        all_dimensions.append(_parse_dimension(raw))

    library = RulesLibrary(dimensions=all_dimensions, version=version)
    library.validate()
    return library


# ---- CLI entry point for manual testing ----


if __name__ == "__main__":
    import sys
    rules_dir = sys.argv[1] if len(sys.argv) > 1 else "../rules"
    lib = load_rules_library(rules_dir)
    print(f"Loaded {len(lib.dimensions)} dimensions:")
    for d in lib.dimensions:
        print(f"  {d.id}: {d.name} (weight={d.weight}, {len(d.questions)} questions)")
