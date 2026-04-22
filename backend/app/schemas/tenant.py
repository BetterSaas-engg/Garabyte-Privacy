"""Tenant API schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    """Payload for POST /tenants."""
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: str = Field(..., min_length=1, max_length=255)
    sector: str = Field(..., pattern=r"^(utility|healthcare|telecom|other)$")
    jurisdiction: str = "Canada"
    employee_count: Optional[int] = Field(None, ge=1, le=1_000_000)


class TenantOut(BaseModel):
    """Response shape for GET /tenants and /tenants/{slug}."""
    id: int
    slug: str
    name: str
    sector: str
    jurisdiction: str
    employee_count: Optional[int] = None
    is_demo: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantHistoryItem(BaseModel):
    """One row in the score history over time."""
    assessment_id: int
    label: Optional[str]
    overall_score: Optional[float]
    overall_maturity: Optional[str]
    completed_at: Optional[datetime]
