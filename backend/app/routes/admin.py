"""
Admin endpoints — Garabyte-admin-only views into platform-wide state.

These routes are NOT scoped to a single tenant; they expect the caller to
hold the `garabyte_admin` role on at least one membership row. Any other
role (org_admin, consultant, etc.) is rejected even if it has cross-tenant
visibility through other means.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..auth.service import log_access
from ..database import get_db
from ..models import (
    AccessLog,
    ROLE_GARABYTE_ADMIN,
    Tenant,
    User,
)


router = APIRouter(prefix="/admin", tags=["admin"])


class AccessLogRow(BaseModel):
    id: int
    at: datetime
    user_id: Optional[int]
    user_email: Optional[str]
    org_id: Optional[int]
    org_slug: Optional[str]
    action: str
    resource_kind: Optional[str]
    resource_id: Optional[int]
    ip: Optional[str]
    context: Optional[dict]

    model_config = ConfigDict(from_attributes=True)


def _require_garabyte_admin(user: User, request: Request, db: Session, action: str) -> None:
    """Reject anyone who doesn't carry a garabyte_admin role. Logs denials."""
    if not any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships):
        log_access(
            db,
            user_id=user.id,
            action=f"{action}.denied",
            ip=request.client.host if request.client else None,
        )
        db.commit()
        raise HTTPException(status_code=403, detail="Garabyte admin only")


@router.get("/access-log", response_model=list[AccessLogRow])
def list_access_log(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    org_id: Optional[int] = Query(None, description="Filter to one tenant"),
    user_id: Optional[int] = Query(None, description="Filter to one actor"),
    action: Optional[str] = Query(None, max_length=64, description="Action prefix to filter on"),
):
    """
    Read the append-only audit log. Garabyte admin only — this exposes
    every customer's activity, so it's a privileged surface.

    Default ordering is most-recent first. The audit log itself is bounded
    in growth (rows accumulate forever) so callers must paginate.
    """
    _require_garabyte_admin(user, request, db, action="access_log.read")

    q = db.query(AccessLog).order_by(AccessLog.at.desc())
    if org_id is not None:
        q = q.filter(AccessLog.org_id == org_id)
    if user_id is not None:
        q = q.filter(AccessLog.user_id == user_id)
    if action:
        q = q.filter(AccessLog.action.like(f"{action}%"))

    rows = q.offset(offset).limit(limit).all()

    # Hydrate join-side fields without an N+1: pull the unique ids in this
    # page and build lookup dicts. Audit log rows are append-only so the
    # joined data won't move under us mid-page.
    user_ids = {r.user_id for r in rows if r.user_id is not None}
    org_ids = {r.org_id for r in rows if r.org_id is not None}
    users_by_id = {
        u.id: u
        for u in (db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else [])
    }
    orgs_by_id = {
        t.id: t
        for t in (db.query(Tenant).filter(Tenant.id.in_(org_ids)).all() if org_ids else [])
    }

    log_access(
        db,
        user_id=user.id,
        action="access_log.read",
        ip=request.client.host if request.client else None,
        context={"limit": limit, "offset": offset, "returned": len(rows)},
    )
    db.commit()

    return [
        AccessLogRow(
            id=r.id,
            at=r.at,
            user_id=r.user_id,
            user_email=users_by_id[r.user_id].email if r.user_id in users_by_id else None,
            org_id=r.org_id,
            org_slug=orgs_by_id[r.org_id].slug if r.org_id in orgs_by_id else None,
            action=r.action,
            resource_kind=r.resource_kind,
            resource_id=r.resource_id,
            ip=r.ip,
            context=r.context,
        )
        for r in rows
    ]
