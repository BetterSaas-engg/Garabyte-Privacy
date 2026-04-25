"""Assessment API schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


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

    model_config = {"from_attributes": True}


class ResponseSubmit(BaseModel):
    """A single question response in a bulk submit."""
    question_id: str = Field(..., min_length=1, max_length=32)
    value: int = Field(..., ge=0, le=4)
    note: Optional[str] = Field(None, max_length=2000)


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
