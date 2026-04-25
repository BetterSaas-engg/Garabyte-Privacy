"""
Auth service — pure helpers used by routes and middleware.

These functions take a SQLAlchemy session as their first argument and never
read FastAPI request state directly, so they're testable in isolation.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy.orm import Session

from ..models import (
    AccessLog,
    AuthSession,
    User,
    VerificationToken,
)

# Argon2id with library defaults (OWASP-current as of argon2-cffi 23.x).
# A single PasswordHasher instance is thread-safe; reuse it.
_HASHER = PasswordHasher()

# Session lifetime parameters. See docs/auth-design.md for the rationale.
SESSION_IDLE_DAYS = 14
SESSION_ABSOLUTE_DAYS = 30

# Verification token TTLs.
TOKEN_TTL_VERIFY = timedelta(hours=24)
TOKEN_TTL_MAGIC = timedelta(minutes=15)
TOKEN_TTL_RESET = timedelta(hours=1)
TOKEN_TTL_INVITATION = timedelta(days=7)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash a password with argon2id. Raises ValueError on empty input."""
    if not plain:
        raise ValueError("Password cannot be empty")
    return _HASHER.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Constant-time verify. Returns True on match, False otherwise.
    Never raises -- argon2 mismatch / invalid hash both return False so
    callers don't need to distinguish between user error and library error.
    """
    if not hashed:
        return False
    try:
        return _HASHER.verify(hashed, plain)
    except VerifyMismatchError:
        return False
    except Exception:
        # Malformed hash, library mismatch, etc. Log somewhere upstream
        # if you care, but never leak the reason to the caller.
        return False


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_session(
    db: Session,
    user_id: int,
    *,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuthSession:
    """Create a new server-side session record. Caller is responsible for
    setting the cookie on the HTTP response."""
    now = datetime.utcnow()
    sess = AuthSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(days=SESSION_ABSOLUTE_DAYS),
        ip=ip,
        user_agent=user_agent,
    )
    db.add(sess)
    db.flush()
    return sess


def read_session(db: Session, session_id: str) -> Optional[AuthSession]:
    """
    Look up a session by id. Returns None if missing, expired (absolute), or
    idle-expired. On success, advances last_seen_at (caller must commit).
    """
    if not session_id:
        return None
    sess = db.query(AuthSession).filter(AuthSession.id == session_id).first()
    if not sess:
        return None
    now = datetime.utcnow()
    if sess.expires_at < now:
        return None
    idle_cutoff = now - timedelta(days=SESSION_IDLE_DAYS)
    if sess.last_seen_at < idle_cutoff:
        return None
    sess.last_seen_at = now
    return sess


def revoke_session(db: Session, session_id: str) -> None:
    """Delete a session row. Idempotent."""
    db.query(AuthSession).filter(AuthSession.id == session_id).delete()


# ---------------------------------------------------------------------------
# Verification tokens (email verify, magic link, password reset, invitation)
# ---------------------------------------------------------------------------

def _hash_token(plain: str) -> str:
    """Stable, fast hash of token plaintext. Not for passwords."""
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


def mint_token(
    db: Session,
    *,
    purpose: str,
    email: str,
    user_id: Optional[int] = None,
    ttl: timedelta,
    payload: Optional[dict[str, Any]] = None,
) -> str:
    """
    Mint a single-use token. Returns the plaintext (caller emails it).
    Only the hash is persisted, so a leaked DB doesn't disclose live tokens.
    """
    plain = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    db.add(VerificationToken(
        token_hash=_hash_token(plain),
        user_id=user_id,
        email=email.strip().lower(),
        purpose=purpose,
        payload=payload,
        created_at=now,
        expires_at=now + ttl,
    ))
    db.flush()
    return plain


def consume_token(
    db: Session,
    *,
    plaintext: str,
    purpose: str,
) -> Optional[VerificationToken]:
    """
    Look up a token by purpose + plaintext, mark consumed, return the row.
    Returns None if not found, wrong purpose, expired, or already consumed.
    Caller commits.
    """
    if not plaintext:
        return None
    row = (
        db.query(VerificationToken)
        .filter(
            VerificationToken.token_hash == _hash_token(plaintext),
            VerificationToken.purpose == purpose,
        )
        .first()
    )
    if not row:
        return None
    if row.consumed_at is not None:
        return None
    if row.expires_at < datetime.utcnow():
        return None
    row.consumed_at = datetime.utcnow()
    return row


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def log_access(
    db: Session,
    *,
    user_id: Optional[int],
    org_id: Optional[int] = None,
    action: str,
    resource_kind: Optional[str] = None,
    resource_id: Optional[int] = None,
    ip: Optional[str] = None,
    context: Optional[dict[str, Any]] = None,
) -> AccessLog:
    """Append an audit-log row. Caller commits."""
    row = AccessLog(
        user_id=user_id,
        org_id=org_id,
        action=action,
        resource_kind=resource_kind,
        resource_id=resource_id,
        ip=ip,
        context=context,
    )
    db.add(row)
    return row
