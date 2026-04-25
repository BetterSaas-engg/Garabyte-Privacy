"""Pydantic request/response shapes for auth endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    """POST /auth/signup body."""
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=200)
    name: Optional[str] = Field(None, max_length=255)


class SignupOut(BaseModel):
    """Returned from signup. We don't expose the user id pre-verification."""
    email: EmailStr
    message: str


class VerifyEmailIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class UserOut(BaseModel):
    """Subset of User safe to return to the client."""
    id: int
    email: EmailStr
    name: Optional[str]
    email_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WhoAmIOut(BaseModel):
    """GET /auth/me response: identity + memberships in one round-trip."""
    user: UserOut
    memberships: list["MembershipOut"]


class MembershipOut(BaseModel):
    org_id: int
    org_slug: str
    org_name: str
    role: str
    dimension_ids: Optional[list[str]] = None

    model_config = {"from_attributes": True}


WhoAmIOut.model_rebuild()
