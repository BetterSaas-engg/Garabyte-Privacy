"""
Auth-layer ORM models.

See docs/auth-design.md for the design rationale and docs/roles-and-permissions.md
for the behavioral spec these tables enforce.

Tables:
- users               — identity. One row per human, regardless of how many
                        organizations they belong to.
- org_memberships     — the (user, organization, role) triple. Roles live here,
                        not on User, so a user can be admin in one org and
                        contributor in another (R&P §5a).
- sessions            — server-side session records. The httpOnly cookie holds
                        the session id; this table is the source of truth.
- verification_tokens — one-time tokens for email verification, magic links,
                        password reset, and invitations. Single-use enforced
                        via consumed_at.
- access_log          — append-only audit log. Required by R&P C8/C22 and
                        audit M23. Read by garabyte admin tooling, not by
                        customer-facing surfaces.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base


# Role constants for org_memberships.role.
# Keep aligned with docs/roles-and-permissions.md §1.
ROLE_ORG_ADMIN = "org_admin"
ROLE_SECTION_CONTRIBUTOR = "section_contributor"
ROLE_ORG_VIEWER = "org_viewer"
ROLE_CONSULTANT = "consultant"
ROLE_RULES_EDITOR = "rules_editor"
ROLE_GARABYTE_ADMIN = "garabyte_admin"

ALL_ROLES = (
    ROLE_ORG_ADMIN,
    ROLE_SECTION_CONTRIBUTOR,
    ROLE_ORG_VIEWER,
    ROLE_CONSULTANT,
    ROLE_RULES_EDITOR,
    ROLE_GARABYTE_ADMIN,
)


class User(Base):
    """
    A human identity. Email is the natural identifier. password_hash is null
    while signup is pending email verification or while the user only logs in
    via magic link.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    memberships = relationship(
        "OrgMembership",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    sessions = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


class OrgMembership(Base):
    """
    Joins a User to a Tenant (organization) with a specific role. The
    (user_id, org_id) pair is unique — a user has one role per org.
    For section contributors, dimension_ids is a JSON array of the
    dimensions they can read/write (R&P C5). For other roles it is null.
    """
    __tablename__ = "org_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_org_memberships_user_org"),
        Index("ix_org_memberships_org_role", "org_id", "role"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    # SQLite doesn't have native arrays; JSON list works on both Postgres and SQLite.
    dimension_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="memberships")
    # No back_populates on Tenant — keeping Tenant unchanged this phase.

    def __repr__(self) -> str:
        return f"<OrgMembership user_id={self.user_id} org_id={self.org_id} role={self.role!r}>"


class AuthSession(Base):
    """
    Server-side session. The httpOnly cookie holds the id (UUID); the row
    is the source of truth for validity. last_seen_at supports rolling
    expiry up to expires_at (the absolute hard cap).
    """
    __tablename__ = "sessions"

    # UUID stored as string so we don't depend on a Postgres extension
    # (dialect-portable; SQLite local dev still works).
    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    ip = Column(String(45), nullable=True)  # IPv6 max length
    user_agent = Column(Text, nullable=True)

    user = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:
        return f"<AuthSession id={self.id[:8]}… user_id={self.user_id}>"


# Token purposes — keep aligned with the auth design doc.
TOKEN_EMAIL_VERIFY = "email_verify"
TOKEN_MAGIC_LINK = "magic_link"
TOKEN_PASSWORD_RESET = "password_reset"
TOKEN_INVITATION = "invitation"

ALL_TOKEN_PURPOSES = (
    TOKEN_EMAIL_VERIFY,
    TOKEN_MAGIC_LINK,
    TOKEN_PASSWORD_RESET,
    TOKEN_INVITATION,
)


class VerificationToken(Base):
    """
    One-time tokens. token_hash is sha256 of the plaintext token; the
    plaintext is only ever in the email body. Single-use enforced by
    setting consumed_at on first use.
    """
    __tablename__ = "verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    email = Column(String(255), nullable=False)
    purpose = Column(String(32), nullable=False)
    payload: Any = Column(JSON, nullable=True)  # invitation: {role, dimension_ids, org_id}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<VerificationToken purpose={self.purpose} email={self.email!r}>"


class AccessLog(Base):
    """
    Append-only audit log. Every privileged action (read, edit, publish,
    delete) emits a row. user_id and org_id are nullable so we can log
    failed-auth attempts (no user) and admin actions (no org).
    Use BigInteger for id since this table grows fast.
    """
    __tablename__ = "access_log"
    __table_args__ = (
        Index("ix_access_log_user_at", "user_id", "at"),
        Index("ix_access_log_org_at", "org_id", "at"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    org_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(64), nullable=False)
    resource_kind = Column(String(32), nullable=True)
    resource_id = Column(Integer, nullable=True)
    ip = Column(String(45), nullable=True)
    context = Column(JSON, nullable=True)
