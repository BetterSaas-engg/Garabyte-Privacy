"""
Auth endpoints: signup, email verification, login/logout, whoami,
magic link, password reset, and invitation acceptance.

All token-driven flows (verify, magic, reset, invitation) share the
single verification_tokens table via the helpers in service.py. Each
flow has its own purpose constant so a token minted for one purpose
can never be consumed by another.

Rate limits: see auth/rate.py for the shared Limiter. Auth endpoints
that touch passwords or send email get explicit per-route caps; everything
else inherits the global default.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    OrgMembership,
    Tenant,
    TOKEN_EMAIL_VERIFY,
    TOKEN_INVITATION,
    TOKEN_MAGIC_LINK,
    TOKEN_PASSWORD_RESET,
    User,
    ALL_ROLES,
)
from .deps import SESSION_COOKIE, get_current_user
from .email import send_email
from .rate import limiter
from .schemas import (
    LoginIn,
    MembershipOut,
    SignupIn,
    SignupOut,
    UserOut,
    VerifyEmailIn,
    WhoAmIOut,
)
from .service import (
    SESSION_ABSOLUTE_DAYS,
    TOKEN_TTL_INVITATION,
    TOKEN_TTL_MAGIC,
    TOKEN_TTL_RESET,
    TOKEN_TTL_VERIFY,
    consume_token,
    create_session,
    hash_password,
    log_access,
    mint_token,
    revoke_session,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _set_session_cookie(response: Response, session_id: str) -> None:
    secure = settings.app_env != "development"
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_id,
        max_age=SESSION_ABSOLUTE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/")


def _to_user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        name=u.name,
        email_verified=u.email_verified_at is not None,
        created_at=u.created_at,
    )


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _send_session(
    db: Session,
    request: Request,
    response: Response,
    user: User,
) -> None:
    """Mint a new session for `user` and attach the cookie. Caller commits."""
    sess = create_session(
        db,
        user_id=user.id,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    _set_session_cookie(response, sess.id)


# ---------------------------------------------------------------------------
# Signup + verify (existing flow)
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=SignupOut, status_code=201)
@limiter.limit("5/minute")
def signup(
    payload: SignupIn,
    request: Request,
    db: Session = Depends(get_db),
) -> SignupOut:
    """
    Create an unverified user, mint an email_verify token, send it. Same
    response whether the address is new or already registered (prevents
    enumeration). Rate limited to 5/min per IP to slow brute creation.
    """
    email = _normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()

    if existing is None:
        user = User(
            email=email,
            password_hash=hash_password(payload.password),
            name=payload.name,
        )
        db.add(user)
        db.flush()
        token_user_id = user.id
    else:
        token_user_id = None

    if token_user_id is not None:
        plaintext = mint_token(
            db,
            purpose=TOKEN_EMAIL_VERIFY,
            email=email,
            user_id=token_user_id,
            ttl=TOKEN_TTL_VERIFY,
        )
        send_email(
            to=email,
            subject="Verify your email — Garabyte Privacy Health Check",
            body=(
                f"Hi{(' ' + payload.name) if payload.name else ''},\n\n"
                f"Confirm your email by visiting:\n\n"
                f"  {settings.frontend_base_url}/auth/verify-email?token={plaintext}\n\n"
                f"This link expires in 24 hours.\n"
            ),
        )

    log_access(
        db,
        user_id=token_user_id,
        action="auth.signup",
        ip=_client_ip(request),
        context={"email": email, "existing": existing is not None},
    )
    db.commit()
    return SignupOut(
        email=email,
        message="If this email is new, a verification link is on its way.",
    )


@router.post("/verify-email", response_model=UserOut)
@limiter.limit("20/minute")
def verify_email(
    payload: VerifyEmailIn,
    request: Request,
    db: Session = Depends(get_db),
) -> UserOut:
    row = consume_token(db, plaintext=payload.token, purpose=TOKEN_EMAIL_VERIFY)
    if not row or row.user_id is None:
        log_access(db, user_id=None, action="auth.verify_email.fail",
                   ip=_client_ip(request))
        db.commit()
        raise HTTPException(400, "Invalid or expired verification link")

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        db.commit()
        raise HTTPException(400, "Invalid or expired verification link")

    if user.email_verified_at is None:
        user.email_verified_at = datetime.utcnow()

    log_access(db, user_id=user.id, action="auth.verify_email.ok",
               ip=_client_ip(request))
    db.commit()
    return _to_user_out(user)


# ---------------------------------------------------------------------------
# Login + logout (existing flow)
# ---------------------------------------------------------------------------

@router.post("/login", response_model=UserOut)
@limiter.limit("10/minute")
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    """Verify password, create session, set cookie. Generic error on miss."""
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    ok = bool(user) and verify_password(payload.password, user.password_hash or "")
    if not ok:
        log_access(db, user_id=user.id if user else None, action="auth.login.fail",
                   ip=_client_ip(request), context={"email": email})
        db.commit()
        raise HTTPException(401, "Invalid email or password")

    if user.email_verified_at is None:
        log_access(db, user_id=user.id, action="auth.login.unverified",
                   ip=_client_ip(request))
        db.commit()
        raise HTTPException(403, "Email not verified. Check your inbox.")

    _send_session(db, request, response, user)
    log_access(db, user_id=user.id, action="auth.login.ok",
               ip=_client_ip(request))
    db.commit()
    return _to_user_out(user)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    sid = request.cookies.get(SESSION_COOKIE)
    if sid:
        revoke_session(db, sid)
        log_access(db, user_id=None, action="auth.logout",
                   ip=_client_ip(request), context={"sid_prefix": sid[:8]})
        db.commit()
    _clear_session_cookie(response)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Whoami
# ---------------------------------------------------------------------------

@router.get("/me", response_model=WhoAmIOut)
def whoami(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WhoAmIOut:
    rows = (
        db.query(OrgMembership, Tenant)
        .join(Tenant, Tenant.id == OrgMembership.org_id)
        .filter(OrgMembership.user_id == user.id)
        .all()
    )
    memberships = [
        MembershipOut(
            org_id=t.id,
            org_slug=t.slug,
            org_name=t.name,
            role=m.role,
            dimension_ids=m.dimension_ids,
        )
        for (m, t) in rows
    ]
    return WhoAmIOut(user=_to_user_out(user), memberships=memberships)


# ---------------------------------------------------------------------------
# Magic link
# ---------------------------------------------------------------------------

class MagicRequestIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)


class GenericMessage(BaseModel):
    message: str


@router.post("/magic/request", response_model=GenericMessage)
@limiter.limit("5/minute")
def magic_request(
    payload: MagicRequestIn,
    request: Request,
    db: Session = Depends(get_db),
) -> GenericMessage:
    """
    Email a one-click sign-in link. Same response whether the email is
    registered or not (prevents enumeration). 15-minute TTL.
    """
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if user and user.email_verified_at is not None:
        plaintext = mint_token(
            db,
            purpose=TOKEN_MAGIC_LINK,
            email=email,
            user_id=user.id,
            ttl=TOKEN_TTL_MAGIC,
        )
        send_email(
            to=email,
            subject="Sign in to Garabyte Privacy Health Check",
            body=(
                f"Click to sign in (expires in 15 minutes):\n\n"
                f"  {settings.frontend_base_url}/auth/magic?token={plaintext}\n"
            ),
        )
    log_access(db, user_id=user.id if user else None,
               action="auth.magic.request",
               ip=_client_ip(request), context={"email": email})
    db.commit()
    return GenericMessage(message="If this email is registered, a sign-in link is on its way.")


@router.post("/magic/consume", response_model=UserOut)
@limiter.limit("20/minute")
def magic_consume(
    payload: TokenIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    row = consume_token(db, plaintext=payload.token, purpose=TOKEN_MAGIC_LINK)
    if not row or row.user_id is None:
        log_access(db, user_id=None, action="auth.magic.fail",
                   ip=_client_ip(request))
        db.commit()
        raise HTTPException(400, "Invalid or expired sign-in link")
    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        db.commit()
        raise HTTPException(400, "Invalid or expired sign-in link")
    _send_session(db, request, response, user)
    log_access(db, user_id=user.id, action="auth.magic.ok",
               ip=_client_ip(request))
    db.commit()
    return _to_user_out(user)


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetConfirmIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    new_password: str = Field(..., min_length=12, max_length=200)


@router.post("/password-reset/request", response_model=GenericMessage)
@limiter.limit("5/minute")
def password_reset_request(
    payload: ResetRequestIn,
    request: Request,
    db: Session = Depends(get_db),
) -> GenericMessage:
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if user:
        plaintext = mint_token(
            db,
            purpose=TOKEN_PASSWORD_RESET,
            email=email,
            user_id=user.id,
            ttl=TOKEN_TTL_RESET,
        )
        send_email(
            to=email,
            subject="Reset your password",
            body=(
                f"Reset your password (expires in 60 minutes):\n\n"
                f"  {settings.frontend_base_url}/auth/password-reset?token={plaintext}\n\n"
                f"If you didn't request this, ignore the email.\n"
            ),
        )
    log_access(db, user_id=user.id if user else None,
               action="auth.reset.request",
               ip=_client_ip(request), context={"email": email})
    db.commit()
    return GenericMessage(message="If this email is registered, a reset link is on its way.")


@router.post("/password-reset/confirm", response_model=UserOut)
@limiter.limit("10/minute")
def password_reset_confirm(
    payload: ResetConfirmIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    row = consume_token(db, plaintext=payload.token, purpose=TOKEN_PASSWORD_RESET)
    if not row or row.user_id is None:
        log_access(db, user_id=None, action="auth.reset.fail",
                   ip=_client_ip(request))
        db.commit()
        raise HTTPException(400, "Invalid or expired reset link")
    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        db.commit()
        raise HTTPException(400, "Invalid or expired reset link")
    user.password_hash = hash_password(payload.new_password)
    # Successful reset = log the user in immediately. Also revoke any other
    # active sessions for this user (defense against an attacker who got
    # transient access through a leaked session).
    from ..models import AuthSession
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    _send_session(db, request, response, user)
    log_access(db, user_id=user.id, action="auth.reset.ok",
               ip=_client_ip(request))
    db.commit()
    return _to_user_out(user)


# ---------------------------------------------------------------------------
# Invitations (R&P C1)
# ---------------------------------------------------------------------------

class InvitationCreateIn(BaseModel):
    email: EmailStr
    org_id: int = Field(..., gt=0)
    role: str = Field(..., min_length=1, max_length=32)
    dimension_ids: Optional[list[str]] = None


class InvitationCreateOut(BaseModel):
    email: EmailStr
    org_id: int
    role: str
    expires_in_days: int


class InvitationPreviewOut(BaseModel):
    """Returned to a visitor following the invitation link before accepting.
    Reveals only the org name, role offered, and dimensions — never any
    assessment data (R&P C1)."""
    email: EmailStr
    org_name: str
    org_slug: str
    role: str
    dimension_ids: Optional[list[str]] = None


class InvitationAcceptIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    name: Optional[str] = Field(None, max_length=255)
    # Required for new users; ignored for existing users.
    password: Optional[str] = Field(None, min_length=12, max_length=200)


@router.post("/invitations", response_model=InvitationCreateOut, status_code=201)
def create_invitation(
    payload: InvitationCreateIn,
    request: Request,
    inviter: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InvitationCreateOut:
    """
    Mint an invitation token. R&P C17: org admins invite into their own
    org; C19: garabyte admins issue bootstrap invitations. We check that
    the inviter has either:
      - an org_admin membership in the target org, OR
      - the garabyte_admin role anywhere.

    Section contributor and org viewer roles are issuable by org admins;
    org_admin and garabyte_admin roles require garabyte_admin to issue.
    """
    if payload.role not in ALL_ROLES:
        raise HTTPException(400, f"Unknown role: {payload.role}")

    is_garabyte_admin = any(m.role == "garabyte_admin" for m in inviter.memberships)
    is_org_admin = any(
        m.org_id == payload.org_id and m.role == "org_admin"
        for m in inviter.memberships
    )
    if not (is_garabyte_admin or is_org_admin):
        log_access(db, user_id=inviter.id, org_id=payload.org_id,
                   action="auth.invitation.denied",
                   ip=_client_ip(request))
        db.commit()
        raise HTTPException(403, "You aren't allowed to invite into this organization")

    # Privileged roles must be issued by garabyte admin only.
    if payload.role in ("org_admin", "garabyte_admin", "rules_editor", "consultant"):
        if not is_garabyte_admin:
            raise HTTPException(403, f"Only Garabyte admins may issue the {payload.role} role")

    org = db.query(Tenant).filter(Tenant.id == payload.org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")

    # Audit-fix: validate dimension_ids against the loaded rules library so
    # an attacker can't seed a membership row with a junk or path-traversal
    # dimension string. Section contributors fail-fast on out-of-scope
    # questions (R&P C5), but the row still gets created if we don't gate
    # on the way in.
    if payload.dimension_ids:
        from ..main import RULES
        valid = {d.id for d in RULES.dimensions}
        bad = [d for d in payload.dimension_ids if d not in valid]
        if bad:
            raise HTTPException(
                400,
                f"Unknown dimension id(s): {', '.join(bad)}",
            )

    email = _normalize_email(payload.email)
    plaintext = mint_token(
        db,
        purpose=TOKEN_INVITATION,
        email=email,
        ttl=TOKEN_TTL_INVITATION,
        payload={
            "org_id": payload.org_id,
            "role": payload.role,
            "dimension_ids": payload.dimension_ids,
            "inviter_user_id": inviter.id,
        },
    )
    send_email(
        to=email,
        subject=f"You're invited to {org.name} on Garabyte Privacy Health Check",
        body=(
            f"You've been invited to join {org.name} as {payload.role}.\n\n"
            f"Accept the invitation (expires in 7 days):\n\n"
            f"  {settings.frontend_base_url}/auth/invitations?token={plaintext}\n"
        ),
    )
    log_access(db, user_id=inviter.id, org_id=payload.org_id,
               action="auth.invitation.create",
               ip=_client_ip(request),
               context={"email": email, "role": payload.role})
    db.commit()
    return InvitationCreateOut(
        email=email,
        org_id=payload.org_id,
        role=payload.role,
        expires_in_days=TOKEN_TTL_INVITATION.days,
    )


@router.get("/invitations/preview", response_model=InvitationPreviewOut)
@limiter.limit("20/minute")
def invitation_preview(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> InvitationPreviewOut:
    """
    Reveal what an invitation token offers without consuming it. R&P C1:
    only org name, role, dimensions — never assessment data, and the
    visitor doesn't need to be authenticated.
    """
    # Look up by hash without consuming. Reuse the service layer's helper
    # path by reading the row directly.
    from ..models import VerificationToken
    from .service import _hash_token
    row = (
        db.query(VerificationToken)
        .filter(
            VerificationToken.token_hash == _hash_token(token),
            VerificationToken.purpose == TOKEN_INVITATION,
        )
        .first()
    )
    if not row or row.consumed_at is not None or row.expires_at < datetime.utcnow():
        raise HTTPException(400, "Invalid or expired invitation")
    org = db.query(Tenant).filter(Tenant.id == row.payload["org_id"]).first()
    if not org:
        raise HTTPException(400, "Invalid or expired invitation")
    return InvitationPreviewOut(
        email=row.email,
        org_name=org.name,
        org_slug=org.slug,
        role=row.payload["role"],
        dimension_ids=row.payload.get("dimension_ids"),
    )


@router.post("/invitations/accept", response_model=UserOut)
@limiter.limit("10/minute")
def accept_invitation(
    payload: InvitationAcceptIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    """
    Consume an invitation token. If the email is new, create the user
    (password required). If the email already has an account, just add the
    membership. Either way, the inviter's email-bound contract (R&P C1) is
    enforced: the accepting user IS the invited email.
    """
    row = consume_token(db, plaintext=payload.token, purpose=TOKEN_INVITATION)
    if not row:
        log_access(db, user_id=None, action="auth.invitation.fail",
                   ip=_client_ip(request))
        db.commit()
        raise HTTPException(400, "Invalid or expired invitation")

    email = _normalize_email(row.email)
    org_id = row.payload["org_id"]
    role = row.payload["role"]
    dimension_ids = row.payload.get("dimension_ids")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        if not payload.password:
            db.commit()
            raise HTTPException(400, "Password required to accept invitation as a new user")
        user = User(
            email=email,
            password_hash=hash_password(payload.password),
            name=payload.name,
            email_verified_at=datetime.utcnow(),  # invitation acceptance proves email control
        )
        db.add(user)
        db.flush()

    # Only add the membership if it doesn't exist (idempotent re-acceptance).
    existing_m = (
        db.query(OrgMembership)
        .filter(OrgMembership.user_id == user.id, OrgMembership.org_id == org_id)
        .first()
    )
    if existing_m:
        # Don't silently overwrite an existing role — surface the conflict.
        if existing_m.role != role:
            raise HTTPException(409, f"You already have role '{existing_m.role}' in this organization")
    else:
        db.add(OrgMembership(
            user_id=user.id,
            org_id=org_id,
            role=role,
            dimension_ids=dimension_ids,
        ))
        db.flush()

    _send_session(db, request, response, user)
    log_access(db, user_id=user.id, org_id=org_id,
               action="auth.invitation.accept",
               ip=_client_ip(request),
               context={"role": role})
    db.commit()
    return _to_user_out(user)
