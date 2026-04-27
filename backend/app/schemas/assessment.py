"""Assessment API schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from ..config import settings


class AssessmentCreate(BaseModel):
    """Payload for POST /tenants/{tenant_id}/assessments."""
    label: Optional[str] = Field(None, max_length=255)


class AssessmentOut(BaseModel):
    """Response shape for GET /assessments/{id}."""
    id: int
    tenant_id: int
    label: Optional[str] = None
    status: str
    overall_score: Optional[float] = None
    overall_maturity: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    # Phase 5: when the consultant published the report. Until set, the
    # customer dashboard shows "Awaiting consultant review" instead of
    # the rendered report (R&P C14).
    published_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ResponseSubmit(BaseModel):
    """
    A single question response in a bulk submit. Either:
      - value is in [0..4] (answered), OR
      - skipped is True and value is None (explicitly skipped, M21)
    Both states overwrite any existing row for the same question.
    """
    question_id: str = Field(..., min_length=1, max_length=32)
    value: Optional[int] = Field(None, ge=0, le=4)
    skipped: bool = False
    skip_reason: Optional[str] = Field(None, max_length=32)
    note: Optional[str] = Field(None, max_length=2000)
    # Optional pointer to evidence (a doc the consultant can click through
    # to verify the answer). Restricted to http/https so we don't accept
    # javascript:, file://, data:, etc. The 512-char cap matches the model
    # column length. Frontend should never render this URL without
    # treating it as untrusted user input.
    #
    # Audit-fix A8: in production, plain http:// is rejected too — the
    # regex accepts both for dev convenience but the field_validator
    # below tightens to https-only when app_env != "development".
    evidence_url: Optional[str] = Field(
        None,
        max_length=512,
        pattern=r"^https?://",
    )

    @field_validator("evidence_url")
    @classmethod
    def _evidence_url_https_in_prod(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if settings.app_env != "development" and not v.startswith("https://"):
            raise ValueError("evidence_url must use https:// in production")
        return v

    @model_validator(mode="after")
    def _value_xor_skipped(self) -> "ResponseSubmit":
        if self.skipped and self.value is not None:
            raise ValueError("A skipped response cannot also carry a value")
        if not self.skipped and self.value is None:
            raise ValueError("Either provide a value (0-4) or set skipped=true")
        return self


class ResponseOut(BaseModel):
    """Response shape for GET /assessments/{id}/responses."""
    # Phase 10: surfacing the row id so the evidence-upload endpoint can
    # be called against it without a separate lookup round-trip.
    id: int
    question_id: str
    value: Optional[int]
    skipped: bool
    skip_reason: Optional[str]
    note: Optional[str]
    evidence_url: Optional[str]
    answered_at: Optional[datetime]
    # Phase 9: who answered this question. Distinct from the requester so
    # the dashboard can show "answered by Sam (org admin)" or "by Maya
    # (privacy lead)" — supports the multi-stakeholder narrative.
    answered_by_id: Optional[int] = None
    answered_by_email: Optional[str] = None

    model_config = {"from_attributes": True}


class BulkResponsesSubmit(BaseModel):
    """Payload for POST /assessments/{id}/responses -- array of responses."""
    # max_length=200 is well above the current 40 actual questions; keeps a
    # malicious or runaway client from POSTing gigabytes of responses.
    responses: list[ResponseSubmit] = Field(..., min_length=1, max_length=200)


class BulkResponsesResult(BaseModel):
    """Response shape for the bulk responses endpoint -- counts of what changed."""
    created: int
    updated: int


class AssessmentResultOut(BaseModel):
    """Response shape for POST /assessments/{id}/score and GET /.../result."""
    assessment: AssessmentOut
    result: dict[str, Any]
