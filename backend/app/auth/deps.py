"""
FastAPI dependencies for auth and authorization.

`get_current_user` reads the session cookie, looks up the session, refreshes
its last_seen_at, and returns the User. Raises 401 on any failure.

`require_membership` is a dependency factory: it returns a dependency that
verifies the current user has a non-revoked membership in a given org with
one of the allowed roles. Raises 403 otherwise. Always logs the attempt.

Usage:

    from app.auth.deps import get_current_user, require_membership

    @router.get("/{tenant_id}/something")
    def handler(
        tenant_id: int,
        user: User = Depends(get_current_user),
        membership = Depends(require_membership(roles=("org_admin", "consultant"))),
        db: Session = Depends(get_db),
    ):
        ...

The `require_membership` factory takes the org id from a path parameter named
`tenant_id` by default. Override with `org_id_param=` for routes that name it
differently.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import OrgMembership, User, ROLE_GARABYTE_ADMIN
from .service import read_session, log_access

SESSION_COOKIE = "gp_session"


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Resolve the authenticated user from the session cookie. Raises 401 if
    not authenticated, session expired, or user no longer exists.
    """
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    sess = read_session(db, sid)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )
    # read_session advanced last_seen_at; commit so the refresh persists.
    db.commit()
    return sess.user


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Same as get_current_user but returns None on missing/expired session.
    For endpoints with public + private modes (e.g. landing data plus
    optional personalization).
    """
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        return None
    sess = read_session(db, sid)
    if not sess:
        return None
    db.commit()
    return sess.user


def ensure_membership(
    db: Session,
    user: User,
    org_id: int,
    *,
    roles: tuple[str, ...],
    request: Optional[Request] = None,
    action: str = "membership.check",
) -> OrgMembership:
    """
    Plain (non-FastAPI) authorization check for routes that resolve the
    org id from a slug or assessment id rather than a path param.

    Garabyte admins implicitly bypass org-membership requirements per R&P
    C4 (with the audit-log entry tagged as elevated access). The Phase 3
    implementation logs this as a regular membership check; a separate
    "support access elevation" flow (R&P §6 / audit M23) is a fast-follow.

    Raises 403 on miss. Always logs to access_log; caller commits.
    """
    # Garabyte admins have implicit cross-org access.
    if any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships):
        log_access(
            db,
            user_id=user.id,
            org_id=org_id,
            action=action,
            ip=request.client.host if request and request.client else None,
            context={"required": list(roles), "got": "garabyte_admin", "elevated": True},
        )
        # Synthesize a membership record at the requested role for the
        # caller's convenience (don't persist — admins aren't actually
        # members of the customer org).
        return OrgMembership(user_id=user.id, org_id=org_id, role=ROLE_GARABYTE_ADMIN)

    m = (
        db.query(OrgMembership)
        .filter(OrgMembership.user_id == user.id, OrgMembership.org_id == org_id)
        .first()
    )
    log_access(
        db,
        user_id=user.id,
        org_id=org_id,
        action=action,
        ip=request.client.host if request and request.client else None,
        context={"required": list(roles), "got": m.role if m else None},
    )
    if not m or m.role not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this organization",
        )
    return m


def require_membership(
    *,
    roles: tuple[str, ...],
    org_id_param: str = "tenant_id",
):
    """
    Factory: returns a dependency that enforces (current user has membership
    in the org named by `org_id_param` with role in `roles`). Raises 403 on
    miss. Always logs to access_log so denied attempts are auditable.

    Pass the path parameter name via `org_id_param` (default "tenant_id"
    matches the existing route names).
    """
    def _dep(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> OrgMembership:
        # Pull the org id from the URL path. FastAPI populates path_params
        # before deps run.
        raw = request.path_params.get(org_id_param)
        if raw is None:
            raise RuntimeError(
                f"require_membership: route does not have a '{org_id_param}' "
                f"path param"
            )
        try:
            org_id = int(raw)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {org_id_param}",
            )
        m = (
            db.query(OrgMembership)
            .filter(
                OrgMembership.user_id == user.id,
                OrgMembership.org_id == org_id,
            )
            .first()
        )
        log_access(
            db,
            user_id=user.id,
            org_id=org_id,
            action="membership.check",
            ip=request.client.host if request.client else None,
            context={
                "required": list(roles),
                "got": m.role if m else None,
                "path": str(request.url.path),
            },
        )
        # commit the audit row whether or not the check passes
        db.commit()
        if not m or m.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this organization",
            )
        return m
    return _dep
