"""Findings + annotations API schemas (phase 5)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class FindingOut(BaseModel):
    """
    A finding in its merged (post-annotation) shape, plus the engine's
    original values exposed alongside so the consultant console can render
    a side-by-side diff. Customer-facing surfaces should use only the
    top-level effective fields and ignore engine_* / annotation_*.

    annotation_status meanings:
        unreviewed         - no annotation row exists; engine output as-is
        confirmed          - consultant approved as-is
        severity_adjusted  - severity overridden, prose unchanged
        replaced           - one or more prose fields rewritten
        dismissed          - finding hidden from the customer report
    """
    id: int
    assessment_id: int
    dimension_id: str
    finding_template_id: Optional[str] = None

    # Effective (post-annotation) values. The customer sees these.
    severity: str
    finding_text: str
    recommendation: Optional[str] = None
    regulatory_risk: Optional[str] = None
    typical_consulting_hours: Optional[int] = None
    upsell_hook: Optional[str] = None

    # Engine layer for the consultant's diff view. Always populated; equal
    # to top-level fields when annotation_status is "unreviewed" or
    # "confirmed".
    engine_severity: str
    engine_finding_text: str
    engine_recommendation: Optional[str] = None
    engine_regulatory_risk: Optional[str] = None
    engine_hours: Optional[int] = None

    source: str          # 'engine' | 'consultant'
    score: Optional[float] = None

    annotation_status: str
    annotation_rationale: Optional[str] = None
    annotation_consultant_id: Optional[int] = None
    annotation_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnnotationCreate(BaseModel):
    """Body for POST /findings/{id}/annotations."""
    status: str = Field(..., min_length=1, max_length=32)

    new_severity: Optional[str] = Field(None, max_length=16)
    new_finding_text: Optional[str] = Field(None, max_length=8000)
    new_recommendation: Optional[str] = Field(None, max_length=8000)
    new_regulatory_risk: Optional[str] = Field(None, max_length=8000)
    new_hours: Optional[int] = Field(None, ge=0, le=10000)

    rationale: Optional[str] = Field(None, max_length=8000)

    @model_validator(mode="after")
    def _check_status_payload(self) -> "AnnotationCreate":
        from ..models import (
            ALL_ANNOTATION_STATUSES,
            ANNOTATION_CONFIRMED,
            ANNOTATION_DISMISSED,
            ANNOTATION_REPLACED,
            ANNOTATION_SEVERITY_ADJUSTED,
        )
        if self.status not in ALL_ANNOTATION_STATUSES:
            raise ValueError(
                f"status must be one of {sorted(ALL_ANNOTATION_STATUSES)}"
            )
        # rationale required for any non-confirmed status (so the audit
        # trail captures *why* the engine output was overridden).
        if self.status != ANNOTATION_CONFIRMED and not (self.rationale or "").strip():
            raise ValueError(
                "rationale is required for non-confirmed annotations"
            )
        # severity_adjusted requires a new_severity; nothing else.
        if self.status == ANNOTATION_SEVERITY_ADJUSTED:
            if not self.new_severity:
                raise ValueError("severity_adjusted requires new_severity")
        # replaced requires at least one of the new_* prose fields.
        if self.status == ANNOTATION_REPLACED:
            if not any([
                self.new_severity,
                self.new_finding_text,
                self.new_recommendation,
                self.new_regulatory_risk,
                self.new_hours is not None,
            ]):
                raise ValueError(
                    "replaced requires at least one new_* field"
                )
        # dismissed: no new_* values are meaningful; reject for clarity.
        if self.status == ANNOTATION_DISMISSED:
            if any([
                self.new_severity, self.new_finding_text, self.new_recommendation,
                self.new_regulatory_risk, self.new_hours is not None,
            ]):
                raise ValueError("dismissed annotations cannot carry new_* fields")
        return self


class AnnotationOut(BaseModel):
    id: int
    finding_id: int
    consultant_id: Optional[int]
    status: str
    new_severity: Optional[str]
    new_finding_text: Optional[str]
    new_recommendation: Optional[str]
    new_regulatory_risk: Optional[str]
    new_hours: Optional[int]
    rationale: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PublishCreate(BaseModel):
    """Body for POST /assessments/{id}/publish."""
    cover_note: Optional[str] = Field(None, max_length=8000)


class PublicationOut(BaseModel):
    id: int
    assessment_id: int
    published_by_id: Optional[int]
    published_at: datetime
    cover_note: Optional[str]

    model_config = {"from_attributes": True}
