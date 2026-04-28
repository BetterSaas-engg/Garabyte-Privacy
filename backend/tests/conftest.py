"""
Shared pytest fixtures.

Strategy: each test gets its own temporary SQLite DB (function-scoped
tmp file). Alembic migrations apply once per session via init_db on the
first session.commit; subsequent commits no-op. This is faster than
spinning up Postgres for unit tests and matches local-dev parity.

Fixtures:
  - tmp_db_url      — fresh SQLite file path; cleaned at teardown
  - test_app        — FastAPI app pinned to the tmp DB
  - test_client     — TestClient over test_app, with X-Requested-With
                      pre-set on every mutating request
  - db_session      — direct SQLAlchemy session against the tmp DB,
                      for arrange-side seeding
  - auth_admin      — a garabyte_admin User + valid session id
  - auth_org_admin  — an org_admin on a fresh tenant + session id
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path

import pytest


# Make the application package importable regardless of where pytest is run.
import sys
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))


@pytest.fixture
def tmp_db_url(tmp_path) -> str:
    """A fresh SQLite file URL per test, with PRAGMA foreign_keys=ON."""
    db_file = tmp_path / f"test_{uuid.uuid4().hex[:8]}.db"
    return f"sqlite:///{db_file}"


@pytest.fixture
def test_app(tmp_db_url, monkeypatch):
    """
    Build a FastAPI app pinned to the tmp DB. We have to set DATABASE_URL
    before importing app modules because the engine is created at import
    time.
    """
    monkeypatch.setenv("DATABASE_URL", tmp_db_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("EMAIL_BACKEND", "stdout")

    # Drop any cached imports so the engine is rebuilt against the new URL.
    for mod in list(sys.modules):
        if mod.startswith("app"):
            del sys.modules[mod]

    from app.main import app  # noqa: E402
    return app


@pytest.fixture
def db_session(test_app):
    """A direct SQLAlchemy Session for arrange-side seeding."""
    from app.database import SessionLocal, init_db
    init_db()  # apply migrations to the tmp DB
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_client(test_app, db_session):
    """
    TestClient that auto-includes X-Requested-With on mutating verbs
    (matches the production CSRF guard expectation).
    """
    from fastapi.testclient import TestClient

    class _Client(TestClient):
        def request(self, method, url, **kw):
            if method.upper() in ("POST", "PUT", "PATCH", "DELETE"):
                headers = dict(kw.pop("headers", {}) or {})
                headers.setdefault("X-Requested-With", "garabyte")
                kw["headers"] = headers
            return super().request(method, url, **kw)

    return _Client(test_app)


@pytest.fixture
def auth_admin(db_session):
    """
    Create a garabyte_admin user + an anchor tenant + a live session.
    Returns (user, session_id).
    """
    from app.models import User, OrgMembership, Tenant, ROLE_GARABYTE_ADMIN
    from app.auth.service import create_session, hash_password

    tenant = Tenant(slug=f"anchor-{uuid.uuid4().hex[:6]}", name="Anchor", sector="other")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    user = User(
        email=f"admin-{uuid.uuid4().hex[:6]}@example.com",
        email_verified_at=datetime.utcnow(),
        password_hash=hash_password("correcthorse1234"),
        name="Admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    db_session.add(OrgMembership(user_id=user.id, org_id=tenant.id, role=ROLE_GARABYTE_ADMIN))
    db_session.commit()

    sess = create_session(db_session, user.id)
    db_session.commit()
    return user, sess.id


@pytest.fixture
def auth_org_admin(db_session):
    """
    Create an org_admin user on a fresh tenant. Returns (user, tenant, session_id).
    """
    from app.models import User, OrgMembership, Tenant, ROLE_ORG_ADMIN
    from app.auth.service import create_session, hash_password

    tenant = Tenant(slug=f"acme-{uuid.uuid4().hex[:6]}", name="Acme Test", sector="other")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    user = User(
        email=f"acme-{uuid.uuid4().hex[:6]}@example.com",
        email_verified_at=datetime.utcnow(),
        password_hash=hash_password("correcthorse1234"),
        name="Acme Admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    db_session.add(OrgMembership(user_id=user.id, org_id=tenant.id, role=ROLE_ORG_ADMIN))
    db_session.commit()

    sess = create_session(db_session, user.id)
    db_session.commit()
    return user, tenant, sess.id
