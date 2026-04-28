"""Tenant API schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    """Payload for POST /tenants."""
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: str = Field(..., min_length=1, max_length=255)
    sector: str = Field(
        ...,
        pattern=r"^(utility|healthcare|telecom|saas|financial_services|non_profit|retail|government|other)$",
    )
    jurisdiction: str = "Canada"
    # ISO-style jurisdiction codes for regulatory citation filtering
    # (audit M22). e.g. ["CA", "CA-QC"] for a Quebec-based Canadian
    # tenant. Empty/omitted means "show every regulation in citations."
    jurisdiction_codes: Optional[list[str]] = Field(None, max_length=20)
    employee_count: Optional[int] = Field(None, ge=1, le=1_000_000)


class TenantOut(BaseModel):
    """Response shape for GET /tenants and /tenants/{slug}."""
    id: int
    slug: str
    name: str
    sector: str
    jurisdiction: str
    jurisdiction_codes: Optional[list[str]] = None
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
    # Phase 5: customer-facing trend should distinguish "scored but
    # awaiting consultant review" from "published". Frontend renders
    # the published row as authoritative and grays the unpublished one.
    published_at: Optional[datetime] = None
    # Rules-library version this assessment was scored under. Lets the
    # trend chart draw a discontinuity marker when adjacent assessments
    # were scored under different libraries — so a customer reading the
    # trend doesn't mistake a rules-update wobble for a program change.
    # (Audit H11 customer-visible half.)
    rules_version: Optional[str] = None
