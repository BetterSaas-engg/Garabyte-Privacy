"""
Auth endpoints: signup, email verification, login, logout, whoami.

Magic link, password reset, and invitation acceptance share the same
verification-token machinery and can be added in fast-follow PRs.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    OrgMembership,
    Tenant,
    TOKEN_EMAIL_VERIFY,
    User,
)
from .deps import SESSION_COOKIE, get_current_user
from .email import send_email
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


# --- POST /auth/signup -----------------------------------------------------

@router.post("/signup", response_model=SignupOut, status_code=201)
def signup(
    payload: SignupIn,
    request: Request,
    db: Session = Depends(get_db),
) -> SignupOut:
    """
    Create a new (unverified) user, mint an email-verification token, send
    the link. Returns the same response whether the email already exists or
    not -- prevents account enumeration.
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
        # Don't reveal that this address is registered. Skip token mint;
        # legitimate user can use password reset to recover access.
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
                f"  https://app.example/auth/verify-email?token={plaintext}\n\n"
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


# --- POST /auth/verify-email ----------------------------------------------

@router.post("/verify-email", response_model=UserOut)
def verify_email(
    payload: VerifyEmailIn,
    request: Request,
    db: Session = Depends(get_db),
) -> UserOut:
    """Consume an email-verification token. Marks user.email_verified_at."""
    row = consume_token(db, plaintext=payload.token, purpose=TOKEN_EMAIL_VERIFY)
    if not row or row.user_id is None:
        log_access(
            db,
            user_id=None,
            action="auth.verify_email.fail",
            ip=_client_ip(request),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        # Token referenced a deleted user. Treat as invalid.
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    if user.email_verified_at is None:
        user.email_verified_at = datetime.utcnow()

    log_access(
        db,
        user_id=user.id,
        action="auth.verify_email.ok",
        ip=_client_ip(request),
    )
    db.commit()
    return _to_user_out(user)


# --- POST /auth/login ------------------------------------------------------

@router.post("/login", response_model=UserOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    """
    Verify credentials, create a session, set the cookie. Generic error
    message on failure to prevent account enumeration.
    """
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()

    ok = bool(user) and verify_password(payload.password, user.password_hash or "")
    if not ok:
        log_access(
            db,
            user_id=user.id if user else None,
            action="auth.login.fail",
            ip=_client_ip(request),
            context={"email": email},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.email_verified_at is None:
        log_access(
            db,
            user_id=user.id,
            action="auth.login.unverified",
            ip=_client_ip(request),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Check your inbox for the verification link.",
        )

    sess = create_session(
        db,
        user_id=user.id,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    _set_session_cookie(response, sess.id)
    log_access(
        db,
        user_id=user.id,
        action="auth.login.ok",
        ip=_client_ip(request),
    )
    db.commit()
    return _to_user_out(user)


# --- POST /auth/logout -----------------------------------------------------

@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    """
    Revoke the current session and clear the cookie. Always returns 204
    even if no session was present -- logout is idempotent.
    """
    sid = request.cookies.get(SESSION_COOKIE)
    if sid:
        revoke_session(db, sid)
        log_access(
            db,
            user_id=None,
            action="auth.logout",
            ip=_client_ip(request),
            context={"sid_prefix": sid[:8]},
        )
        db.commit()
    _clear_session_cookie(response)
    return Response(status_code=204)


# --- GET /auth/me ---------------------------------------------------------

@router.get("/me", response_model=WhoAmIOut)
def whoami(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WhoAmIOut:
    """Identity + memberships in one round-trip. The frontend uses this to
    decide which UI surfaces to render."""
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
