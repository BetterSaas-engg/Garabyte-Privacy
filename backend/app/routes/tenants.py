"""Tenant management endpoints. All endpoints require auth (Phase 3)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth.deps import ensure_membership, get_current_user
from ..auth.service import log_access
from ..database import get_db
from ..models import (
    OrgMembership,
    ROLE_CONSULTANT,
    ROLE_GARABYTE_ADMIN,
    ROLE_ORG_ADMIN,
    ROLE_ORG_VIEWER,
    ROLE_SECTION_CONTRIBUTOR,
    Tenant,
    User,
)
from ..schemas import TenantCreate, TenantOut, TenantHistoryItem


router = APIRouter(prefix="/tenants", tags=["tenants"])


# Roles allowed to read tenant-scoped data. Garabyte admin is handled via
# implicit elevation in ensure_membership.
_TENANT_READ_ROLES = (
    ROLE_ORG_ADMIN,
    ROLE_SECTION_CONTRIBUTOR,
    ROLE_ORG_VIEWER,
    ROLE_CONSULTANT,
)


@router.get("", response_model=list[TenantOut])
def list_tenants(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List the organizations this user belongs to. Garabyte admins see all
    tenants. Other users see only tenants where they have an active
    membership.
    """
    is_garabyte_admin = any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships)
    if is_garabyte_admin:
        rows = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    else:
        rows = (
            db.query(Tenant)
            .join(OrgMembership, OrgMembership.org_id == Tenant.id)
            .filter(OrgMembership.user_id == user.id)
            .order_by(Tenant.created_at.desc())
            .all()
        )
    log_access(db, user_id=user.id, action="tenant.list",
               context={"count": len(rows), "garabyte_admin": is_garabyte_admin})
    db.commit()
    return rows


@router.post("", response_model=TenantOut, status_code=201)
def create_tenant(
    payload: TenantCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new tenant. Garabyte admin only -- customer account creation
    is an internal admin action per R&P §1 (Garabyte admin) and the
    permission matrix row "Customer account creation".
    """
    is_garabyte_admin = any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships)
    if not is_garabyte_admin:
        log_access(db, user_id=user.id, action="tenant.create.denied",
                   ip=request.client.host if request.client else None)
        db.commit()
        raise HTTPException(status_code=403, detail="Only Garabyte admins may create tenants")

    existing = db.query(Tenant).filter(Tenant.slug == payload.slug).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Tenant with slug '{payload.slug}' already exists",
        )
    tenant = Tenant(**payload.model_dump())
    db.add(tenant)
    db.flush()
    log_access(db, user_id=user.id, org_id=tenant.id, action="tenant.create",
               resource_kind="tenant", resource_id=tenant.id,
               ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{slug}", response_model=TenantOut)
def get_tenant(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single tenant by slug. Requires membership in that tenant."""
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {slug}")
    ensure_membership(
        db, user, tenant.id,
        roles=_TENANT_READ_ROLES,
        request=request,
        action="tenant.read",
    )
    log_access(db, user_id=user.id, org_id=tenant.id, action="tenant.read",
               resource_kind="tenant", resource_id=tenant.id,
               ip=request.client.host if request.client else None)
    db.commit()
    return tenant


@router.delete("/{slug}", status_code=204)
def delete_tenant(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DSAR fulfillment — hard-delete a tenant and every assessment, response,
    finding, annotation, publication, and membership it owns. Garabyte
    admin only (audit H4).

    Cascade rules:
      - Assessments / responses / findings / annotations / publications:
        ORM cascade="all, delete-orphan" on Tenant.assessments
        plus FK ondelete=CASCADE on the dependent rows.
      - OrgMembership rows: FK ondelete=CASCADE.
      - AccessLog rows: FK ondelete=SET NULL — audit trail survives the
        deletion (the regulator's "what happened to org X" question still
        needs an answer after the data is gone).
      - VerificationToken invitation rows reference org_id only inside
        their JSON payload; they expire on their own.

    The deletion itself is logged with the tenant's name + slug so the
    audit log can answer "what was deleted" after the row is gone.
    """
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {slug}")

    is_garabyte_admin = any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships)
    if not is_garabyte_admin:
        log_access(
            db, user_id=user.id, org_id=tenant.id, action="tenant.delete.denied",
            resource_kind="tenant", resource_id=tenant.id,
            ip=request.client.host if request.client else None,
        )
        db.commit()
        raise HTTPException(status_code=403, detail="Only Garabyte admins may delete tenants")

    # Snapshot identifying fields before the row vanishes.
    snapshot = {
        "slug": tenant.slug,
        "name": tenant.name,
        "sector": tenant.sector,
        "is_demo": tenant.is_demo,
        "assessment_count": len(tenant.assessments),
    }
    log_access(
        db, user_id=user.id, org_id=tenant.id, action="tenant.delete",
        resource_kind="tenant", resource_id=tenant.id,
        ip=request.client.host if request.client else None,
        context=snapshot,
    )

    db.delete(tenant)
    db.commit()


@router.get("/{slug}/history", response_model=list[TenantHistoryItem])
def get_tenant_history(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the tenant's completed assessments over time, oldest first, so
    the frontend can render a trend chart. Requires membership.
    """
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {slug}")
    ensure_membership(
        db, user, tenant.id,
        roles=_TENANT_READ_ROLES,
        request=request,
        action="tenant.history.read",
    )

    completed = [a for a in tenant.assessments if a.status == "completed"]
    completed.sort(key=lambda a: a.completed_at or a.started_at)

    log_access(db, user_id=user.id, org_id=tenant.id, action="tenant.history.read",
               context={"count": len(completed)},
               ip=request.client.host if request.client else None)
    db.commit()

    return [
        TenantHistoryItem(
            assessment_id=a.id,
            label=a.label,
            overall_score=a.overall_score,
            overall_maturity=a.overall_maturity,
            completed_at=a.completed_at,
            published_at=a.published_at,
        )
        for a in completed
    ]
