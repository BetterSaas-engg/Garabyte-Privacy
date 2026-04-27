"""Tenant management endpoints. All endpoints require auth (Phase 3)."""

from typing import Optional

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
    # Grant the creating garabyte_admin an org_admin membership on the new
    # tenant so it shows up in their own InviteModal dropdown and they can
    # issue invitations / start an assessment without an extra step. The
    # garabyte_admin role still elevates them across all tenants; this is
    # an additional explicit row for UI listing purposes.
    db.add(OrgMembership(user_id=user.id, org_id=tenant.id, role=ROLE_ORG_ADMIN))
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

    # Audit-fix A1: log the intent and commit BEFORE the cascade. If the
    # cascade traversal raises, the intent row still survives — a regulator
    # asking "did anyone try to delete org X?" gets a yes regardless of
    # whether the delete completed. A follow-up "complete" or "failed"
    # row records the outcome.
    snapshot = {
        "slug": tenant.slug,
        "name": tenant.name,
        "sector": tenant.sector,
        "is_demo": tenant.is_demo,
        "assessment_count": len(tenant.assessments),
    }
    tenant_id = tenant.id
    log_access(
        db, user_id=user.id, org_id=tenant_id, action="tenant.delete.intent",
        resource_kind="tenant", resource_id=tenant_id,
        ip=request.client.host if request.client else None,
        context=snapshot,
    )
    # Audit-fix A4: log every share link about to be destroyed by the
    # assessment cascade. Post-DSAR read attempts otherwise hit
    # share_link.read.invalid with resource_id=None and the regulator
    # can't tell what was being probed. With these rows in place, an
    # invalid-token read on the deleted link can be correlated by
    # timestamp + the cascade_delete row's resource_id.
    from ..models import Assessment, ShareLink
    share_links_to_kill = (
        db.query(ShareLink)
        .join(Assessment, ShareLink.assessment_id == Assessment.id)
        .filter(Assessment.tenant_id == tenant_id)
        .all()
    )
    for sl in share_links_to_kill:
        log_access(
            db, user_id=user.id, org_id=tenant_id,
            action="share_link.cascade_delete",
            resource_kind="share_link", resource_id=sl.id,
            ip=request.client.host if request.client else None,
            context={
                "assessment_id": sl.assessment_id,
                "label": sl.label,
                "was_revoked": sl.revoked_at is not None,
                "cascade_reason": "tenant.delete",
            },
        )
    db.commit()

    try:
        # Re-fetch in the new transaction — `tenant` is from the previous
        # session state and SQLAlchemy expects a fresh handle for delete.
        t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if t is not None:
            db.delete(t)
        db.commit()
    except Exception as exc:
        db.rollback()
        log_access(
            db, user_id=user.id, org_id=tenant_id, action="tenant.delete.failed",
            resource_kind="tenant", resource_id=tenant_id,
            ip=request.client.host if request.client else None,
            context={**snapshot, "error": str(exc)[:300]},
        )
        db.commit()
        raise

    # org_id MUST be None here — the tenant row is gone, and the access_log
    # FK rejects an insert pointing at a non-existent tenant. resource_id
    # preserves the dangling reference for forensic correlation.
    log_access(
        db, user_id=user.id, org_id=None, action="tenant.delete.complete",
        resource_kind="tenant", resource_id=tenant_id,
        ip=request.client.host if request.client else None,
        context=snapshot,
    )
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

    # Audit-fix A5: filter at the SQL layer instead of lazy-loading every
    # assessment then list-comp'ing in Python. published_at is read from
    # the publication relationship in the loop below; SQLAlchemy
    # batches that lookup once Assessment.publication is on the orm.
    from ..models import Assessment
    completed = (
        db.query(Assessment)
        .filter(
            Assessment.tenant_id == tenant.id,
            Assessment.status == "completed",
        )
        .order_by(
            Assessment.completed_at.asc().nullsfirst(),
            Assessment.started_at.asc(),
        )
        .all()
    )

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


# ---------------------------------------------------------------------------
# Consultants assigned to the tenant — used by the customer-facing dashboard
# to show "Reviewed by Sarah L., privacy consultant" once published, and
# "Awaiting consultant review by Sarah L." while pending.
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _PydBase, ConfigDict as _PydConfig


class TenantConsultantOut(_PydBase):
    user_id: int
    email: str
    name: Optional[str]

    model_config = _PydConfig(from_attributes=True)


@router.get("/{slug}/consultants", response_model=list[TenantConsultantOut])
def get_tenant_consultants(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Consultants assigned to this tenant. Used by the customer-side
    dashboard so org admins / viewers can see who's reviewing their
    submissions. Same membership requirement as reading the tenant
    itself — visibility is symmetric in both directions.
    """
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {slug}")
    ensure_membership(
        db, user, tenant.id,
        roles=_TENANT_READ_ROLES,
        request=request,
        action="tenant.consultants.read",
    )

    rows = (
        db.query(User)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .filter(
            OrgMembership.org_id == tenant.id,
            OrgMembership.role == ROLE_CONSULTANT,
        )
        .order_by(User.email.asc())
        .all()
    )
    log_access(db, user_id=user.id, org_id=tenant.id,
               action="tenant.consultants.read",
               context={"count": len(rows)},
               ip=request.client.host if request.client else None)
    db.commit()
    return [
        TenantConsultantOut(user_id=u.id, email=u.email, name=u.name)
        for u in rows
    ]
