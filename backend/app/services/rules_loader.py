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
    """A remediation entry that fires when a score meets its trigger condition."""
    severity: str  # "critical" | "high" | "moderate" | "low"
    trigger_condition: str  # e.g. "avg_score < 1.5"
    finding: str
    recommendation: str
    regulatory_risk: str | None = None
    typical_consulting_hours: int | None = None
    upsell_hook: str | None = None


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
    return GapRemediation(
        severity=raw.get("severity", "moderate"),
        trigger_condition=raw.get("trigger_condition") or raw.get("trigger", ""),
        finding=raw.get("finding", ""),
        recommendation=raw.get("recommendation", ""),
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

    for yaml_file in yaml_files:
        with open(yaml_file, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        all_dimensions.append(_parse_dimension(raw))

    library = RulesLibrary(dimensions=all_dimensions)
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
