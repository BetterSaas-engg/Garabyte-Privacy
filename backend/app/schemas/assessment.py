"""Assessment API schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


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
    evidence_url: Optional[str] = Field(
        None,
        max_length=512,
        pattern=r"^https?://",
    )

    @model_validator(mode="after")
    def _value_xor_skipped(self) -> "ResponseSubmit":
        if self.skipped and self.value is not None:
            raise ValueError("A skipped response cannot also carry a value")
        if not self.skipped and self.value is None:
            raise ValueError("Either provide a value (0-4) or set skipped=true")
        return self


class ResponseOut(BaseModel):
    """Response shape for GET /assessments/{id}/responses."""
    question_id: str
    value: Optional[int]
    skipped: bool
    skip_reason: Optional[str]
    note: Optional[str]
    evidence_url: Optional[str]
    answered_at: Optional[datetime]

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
