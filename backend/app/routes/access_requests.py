"""
Access-request funnel — landing-page "Request access" form.

Public POST creates a row anonymously (rate-limited). Admin GET +
PATCH live behind garabyte_admin elevation. Triage is manual: ops
emails the requester directly, then either onboards them via the
existing invitation flow (which creates a tenant + invites the
privacy lead) or marks the request declined.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..auth.rate import limiter
from ..auth.service import log_access
from ..database import get_db
from ..models import (
    AccessRequest,
    ALL_ACCESS_REQUEST_STATUSES,
    ACCESS_REQUEST_PENDING,
    ROLE_GARABYTE_ADMIN,
    User,
)
from ..services.rules_loader import KNOWN_SECTORS


router = APIRouter(tags=["access-requests"])


# -- Schemas -------------------------------------------------------------


class AccessRequestIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    org_name: str = Field(..., min_length=1, max_length=255)
    sector: Optional[str] = Field(None, max_length=64)
    employee_count: Optional[int] = Field(None, ge=1, le=10_000_000)
    message: Optional[str] = Field(None, max_length=4000)


class AccessRequestSubmitOut(BaseModel):
    """What the public form gets back. Deliberately opaque."""
    received: bool


class AccessRequestRow(BaseModel):
    """Admin-queue row. Includes the requester's input + triage state."""
    id: int
    name: str
    email: str
    org_name: str
    sector: Optional[str]
    employee_count: Optional[int]
    message: Optional[str]
    source_ip: Optional[str]
    status: str
    triage_notes: Optional[str]
    triaged_by_id: Optional[int]
    triaged_by_email: Optional[str] = None
    triaged_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccessRequestUpdateIn(BaseModel):
    status: Optional[str] = None
    triage_notes: Optional[str] = Field(None, max_length=4000)


# -- Helpers -------------------------------------------------------------


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _require_garabyte_admin(user: User, request: Request, db: Session, action: str) -> None:
    if not any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships):
        log_access(
            db, user_id=user.id, action=f"{action}.denied",
            ip=_ip(request),
        )
        db.commit()
        raise HTTPException(403, "Garabyte admin only")


# -- Public submit -------------------------------------------------------


@router.post(
    "/access-requests",
    response_model=AccessRequestSubmitOut,
    status_code=201,
)
@limiter.limit("3/minute")
def submit_access_request(
    payload: AccessRequestIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public landing-page form submission. Anonymous. Rate-limited at
    3/min/IP to slow scrape spam. Always returns the same opaque
    response so spammers can't probe whether their submission landed.
    """
    # Validate sector against the known list (defence in depth — the
    # frontend dropdown should only offer valid values, but the API
    # is public).
    if payload.sector and payload.sector not in KNOWN_SECTORS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sector. Expected one of {sorted(KNOWN_SECTORS)}.",
        )

    row = AccessRequest(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        org_name=payload.org_name.strip(),
        sector=payload.sector,
        employee_count=payload.employee_count,
        message=(payload.message or "").strip() or None,
        source_ip=_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:500] or None,
        status=ACCESS_REQUEST_PENDING,
    )
    db.add(row)
    db.flush()

    log_access(
        db, user_id=None, action="access_request.submit",
        resource_kind="access_request", resource_id=row.id,
        ip=_ip(request),
        context={"email": row.email, "org_name": row.org_name},
    )
    db.commit()

    return AccessRequestSubmitOut(received=True)


# -- Admin queue ---------------------------------------------------------


@router.get(
    "/admin/access-requests",
    response_model=list[AccessRequestRow],
)
def list_access_requests(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter to one status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List access requests, newest first. Garabyte admin only."""
    _require_garabyte_admin(user, request, db, action="access_request.list")

    q = db.query(AccessRequest).order_by(AccessRequest.created_at.desc())
    if status:
        if status not in ALL_ACCESS_REQUEST_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown status. Expected one of {list(ALL_ACCESS_REQUEST_STATUSES)}.",
            )
        q = q.filter(AccessRequest.status == status)
    rows = q.offset(offset).limit(limit).all()

    # Hydrate triaged_by_email in a single batched query.
    triager_ids = {r.triaged_by_id for r in rows if r.triaged_by_id}
    emails = (
        {u.id: u.email for u in db.query(User).filter(User.id.in_(triager_ids)).all()}
        if triager_ids else {}
    )

    log_access(
        db, user_id=user.id, action="access_request.list",
        ip=_ip(request),
        context={"returned": len(rows), "status_filter": status},
    )
    db.commit()

    return [
        AccessRequestRow(
            id=r.id,
            name=r.name,
            email=r.email,
            org_name=r.org_name,
            sector=r.sector,
            employee_count=r.employee_count,
            message=r.message,
            source_ip=r.source_ip,
            status=r.status,
            triage_notes=r.triage_notes,
            triaged_by_id=r.triaged_by_id,
            triaged_by_email=emails.get(r.triaged_by_id),
            triaged_at=r.triaged_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.patch(
    "/admin/access-requests/{request_id}",
    response_model=AccessRequestRow,
)
def update_access_request(
    request_id: int,
    payload: AccessRequestUpdateIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update triage state. Garabyte admin only."""
    _require_garabyte_admin(user, request, db, action="access_request.update")

    row = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not row:
        raise HTTPException(404, "Access request not found")

    changes: dict = {}
    if payload.status is not None:
        if payload.status not in ALL_ACCESS_REQUEST_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown status. Expected one of {list(ALL_ACCESS_REQUEST_STATUSES)}.",
            )
        if payload.status != row.status:
            changes["status"] = {"from": row.status, "to": payload.status}
            row.status = payload.status
    if payload.triage_notes is not None:
        changes["triage_notes"] = "updated"
        row.triage_notes = payload.triage_notes

    if changes:
        row.triaged_by_id = user.id
        row.triaged_at = datetime.utcnow()

    log_access(
        db, user_id=user.id, action="access_request.update",
        resource_kind="access_request", resource_id=row.id,
        ip=_ip(request),
        context=changes,
    )
    db.commit()
    db.refresh(row)

    triager_email = None
    if row.triaged_by_id:
        triager = db.query(User).filter(User.id == row.triaged_by_id).first()
        triager_email = triager.email if triager else None

    return AccessRequestRow(
        id=row.id,
        name=row.name,
        email=row.email,
        org_name=row.org_name,
        sector=row.sector,
        employee_count=row.employee_count,
        message=row.message,
        source_ip=row.source_ip,
        status=row.status,
        triage_notes=row.triage_notes,
        triaged_by_id=row.triaged_by_id,
        triaged_by_email=triager_email,
        triaged_at=row.triaged_at,
        created_at=row.created_at,
    )
