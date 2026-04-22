"""Tenant management endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Tenant
from ..schemas import TenantCreate, TenantOut, TenantHistoryItem

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantOut])
def list_tenants(db: Session = Depends(get_db)):
    """List all tenants, newest first."""
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()


@router.post("", response_model=TenantOut, status_code=201)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    """Create a new tenant. Slug must be unique."""
    existing = db.query(Tenant).filter(Tenant.slug == payload.slug).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Tenant with slug '{payload.slug}' already exists",
        )
    tenant = Tenant(**payload.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{slug}", response_model=TenantOut)
def get_tenant(slug: str, db: Session = Depends(get_db)):
    """Get a single tenant by slug."""
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {slug}")
    return tenant


@router.get("/{slug}/history", response_model=list[TenantHistoryItem])
def get_tenant_history(slug: str, db: Session = Depends(get_db)):
    """
    Return the tenant's completed assessments over time,
    oldest first, so the frontend can render a trend chart.
    """
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {slug}")

    completed = [a for a in tenant.assessments if a.status == "completed"]
    completed.sort(key=lambda a: a.completed_at or a.started_at)

    return [
        TenantHistoryItem(
            assessment_id=a.id,
            label=a.label,
            overall_score=a.overall_score,
            overall_maturity=a.overall_maturity,
            completed_at=a.completed_at,
        )
        for a in completed
    ]
