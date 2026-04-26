"""
Signed share links — R&P C21.

A privacy lead (org_admin) can issue a read-only signed URL bound to one
published assessment. The recipient hits `/share/{token}` (frontend) which
calls `GET /share/{token}` here to fetch a redacted report payload.

Surfaces:
  POST   /assessments/{id}/share-links  — issue a new link (org admin)
  GET    /assessments/{id}/share-links  — list active + expired links
  POST   /share-links/{id}/revoke       — revoke an active link
  GET    /share/{token}                 — public read; rate-limited; logs

The /share/{token} endpoint is unauthenticated by design — the token IS
the access credential. We keep the token out of all access_log context
fields so the audit trail itself never leaks the credential.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..auth.deps import ensure_membership, get_current_user
from ..auth.rate import limiter
from ..auth.service import log_access
from ..database import get_db
from ..services.jurisdictions import filter_regulatory_text
from ..models import (
    Assessment,
    AssessmentPublication,
    Finding,
    ROLE_ORG_ADMIN,
    ShareLink,
    Tenant,
    User,
)


router = APIRouter(tags=["share-links"])


# ---------- Schemas ---------------------------------------------------------


class ShareLinkCreate(BaseModel):
    label: Optional[str] = Field(None, max_length=120)
    expires_in_days: int = Field(30, ge=1, le=365)


class ShareLinkOut(BaseModel):
    id: int
    token: str  # full URL token (only returned at create time and to org_admins)
    label: Optional[str]
    created_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime]
    last_accessed_at: Optional[datetime]
    access_count: int
    issued_by_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class SharedFindingOut(BaseModel):
    """Shape of one finding rendered through the share link."""
    dimension_id: str
    severity: str
    finding_text: str
    recommendation: Optional[str]
    regulatory_risk: Optional[str]


class SharedReportOut(BaseModel):
    """Shape of the public, share-link-scoped report payload."""
    tenant_name: str
    assessment_label: Optional[str]
    overall_score: Optional[float]
    overall_maturity: Optional[str]
    published_at: Optional[datetime]
    cover_note: Optional[str]
    findings: list[SharedFindingOut]
    # Watermark hint the frontend renders so a leaked screenshot is traceable.
    share_label: Optional[str]
    share_expires_at: datetime


# ---------- Helpers ---------------------------------------------------------


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _get_active_publication(db: Session, assessment_id: int) -> AssessmentPublication:
    pub = (
        db.query(AssessmentPublication)
        .filter(AssessmentPublication.assessment_id == assessment_id)
        .first()
    )
    if not pub:
        raise HTTPException(
            status_code=400,
            detail="Cannot share an unpublished assessment — publish first",
        )
    return pub


# ---------- Org-admin surfaces ---------------------------------------------


@router.post(
    "/assessments/{assessment_id}/share-links",
    response_model=ShareLinkOut,
    status_code=201,
)
def create_share_link(
    assessment_id: int,
    payload: ShareLinkCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Issue a signed share link. Requires org_admin (the privacy lead) on the
    owning tenant. Garabyte admins inherit access via the admin elevation
    path. The token is shown ONCE (here) — clients should copy it.
    """
    a = (
        db.query(Assessment)
        .filter(Assessment.id == assessment_id)
        .first()
    )
    if not a:
        raise HTTPException(404, "Assessment not found")

    # Refuse to share unpublished reports — the customer would be sharing a
    # consultant's working draft.
    _get_active_publication(db, assessment_id)

    ensure_membership(
        db, user, a.tenant_id,
        roles=(ROLE_ORG_ADMIN,),
        request=request,
        action="share_link.issue.check",
    )

    token = secrets.token_urlsafe(32)
    link = ShareLink(
        token=token,
        assessment_id=assessment_id,
        issued_by_id=user.id,
        label=payload.label,
        expires_at=datetime.utcnow() + timedelta(days=payload.expires_in_days),
    )
    db.add(link)
    db.flush()
    log_access(
        db, user_id=user.id, org_id=a.tenant_id, action="share_link.issue",
        resource_kind="share_link", resource_id=link.id, ip=_ip(request),
        context={
            "assessment_id": assessment_id,
            "expires_in_days": payload.expires_in_days,
        },
    )
    db.commit()
    db.refresh(link)
    return link


@router.get(
    "/assessments/{assessment_id}/share-links",
    response_model=list[ShareLinkOut],
)
def list_share_links(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List share links for one assessment — most recent first. Tokens are
    returned only to org_admins of the owning tenant.
    """
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")

    ensure_membership(
        db, user, a.tenant_id,
        roles=(ROLE_ORG_ADMIN,),
        request=request,
        action="share_link.list.check",
    )

    links = (
        db.query(ShareLink)
        .filter(ShareLink.assessment_id == assessment_id)
        .order_by(ShareLink.created_at.desc())
        .all()
    )
    log_access(
        db, user_id=user.id, org_id=a.tenant_id, action="share_link.list",
        resource_kind="assessment", resource_id=assessment_id,
        context={"count": len(links)}, ip=_ip(request),
    )
    db.commit()
    return links


@router.post("/share-links/{link_id}/revoke", response_model=ShareLinkOut)
def revoke_share_link(
    link_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revoke an active share link. Idempotent — revoking an already-revoked
    link returns the existing row unchanged.
    """
    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(404, "Share link not found")

    a = db.query(Assessment).filter(Assessment.id == link.assessment_id).first()
    if not a:
        raise HTTPException(404, "Underlying assessment not found")

    ensure_membership(
        db, user, a.tenant_id,
        roles=(ROLE_ORG_ADMIN,),
        request=request,
        action="share_link.revoke.check",
    )

    if link.revoked_at is None:
        link.revoked_at = datetime.utcnow()
        log_access(
            db, user_id=user.id, org_id=a.tenant_id,
            action="share_link.revoke",
            resource_kind="share_link", resource_id=link.id,
            ip=_ip(request),
        )
    db.commit()
    db.refresh(link)
    return link


# ---------- Public, token-scoped surface -----------------------------------


@router.get("/share/{token}", response_model=SharedReportOut)
@limiter.limit("30/minute")
def read_shared_report(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Fetch the published report behind a share link. No login required —
    the token IS the credential. Rate-limited (30/minute per IP) to make
    bulk token-guessing infeasible (combined with 256 bits of entropy
    on the token, brute force is already cosmically slow; the rate limit
    is belt-and-suspenders).

    The token never appears in the audit log — only the link's row id.
    """
    now = datetime.utcnow()
    link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not link or not link.is_active(now):
        # Don't distinguish revoked / expired / wrong token in the response —
        # the recipient gets the same message either way.
        log_access(
            db, user_id=None, action="share_link.read.invalid",
            resource_kind="share_link", resource_id=link.id if link else None,
            ip=_ip(request),
        )
        db.commit()
        raise HTTPException(status_code=404, detail="This link is no longer valid.")

    a = db.query(Assessment).filter(Assessment.id == link.assessment_id).first()
    if not a:
        # The assessment was deleted (e.g. DSAR) — same opaque error to the
        # recipient. Audit-fix A4: log this as a "tombstone read" so the
        # audit trail captures who tried to view the report after we said
        # it was gone — this is the surface a regulator is most likely to
        # ask about post-DSAR.
        log_access(
            db, user_id=None, action="share_link.read.tombstone",
            org_id=link.assessment_id and None,  # assessment is gone, no org link
            resource_kind="share_link", resource_id=link.id,
            ip=_ip(request),
            context={"assessment_id": link.assessment_id},
        )
        db.commit()
        raise HTTPException(status_code=404, detail="This link is no longer valid.")

    pub = _get_active_publication(db, a.id)
    tenant = db.query(Tenant).filter(Tenant.id == a.tenant_id).first()

    # Fetch findings and project to the share schema. We deliberately omit
    # typical_consulting_hours and upsell_hook — the share is about the
    # state of the customer's program, not Garabyte's commercial framing.
    findings = (
        db.query(Finding)
        .filter(Finding.assessment_id == a.id)
        .order_by(Finding.id.asc())
        .all()
    )

    link.access_count = (link.access_count or 0) + 1
    link.last_accessed_at = now
    log_access(
        db, action="share_link.read",
        org_id=a.tenant_id,
        resource_kind="share_link", resource_id=link.id,
        ip=_ip(request),
        context={"assessment_id": a.id},
    )
    db.commit()

    # M22 jurisdiction filter — drop regulatory citations to laws the
    # tenant doesn't operate under. A US-only customer's board-shared
    # report shouldn't cite Quebec Law 25.
    tenant_codes = (tenant.jurisdiction_codes if tenant else None) or None

    return SharedReportOut(
        tenant_name=tenant.name if tenant else "—",
        assessment_label=a.label,
        overall_score=a.overall_score,
        overall_maturity=a.overall_maturity,
        published_at=pub.published_at,
        cover_note=pub.cover_note,
        findings=[
            SharedFindingOut(
                dimension_id=f.dimension_id,
                severity=f.severity,
                finding_text=f.finding_text,
                recommendation=f.recommendation,
                regulatory_risk=filter_regulatory_text(f.regulatory_risk, tenant_codes),
            )
            for f in findings
        ],
        share_label=link.label,
        share_expires_at=link.expires_at,
    )
