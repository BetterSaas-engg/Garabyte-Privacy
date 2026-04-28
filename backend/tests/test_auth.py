"""
Auth — invariants the audit explicitly named (A3 invitation identity
guard, A7 user soft-delete, CSRF mutation guard, signup blocked).
"""
from datetime import datetime, timedelta

import pytest


def test_csrf_post_without_xrw_is_blocked(test_app):
    """The middleware rejects mutations missing X-Requested-With."""
    # Build a raw client (don't use the conftest fixture that auto-attaches XRW).
    from fastapi.testclient import TestClient

    raw = TestClient(test_app)
    r = raw.post("/auth/login", json={"email": "x@y.z", "password": "abcdefghijkl"})
    assert r.status_code == 403
    assert "X-Requested-With" in r.json().get("detail", "")


def test_signup_endpoint_disabled(test_client):
    """Self-signup is disabled — invitation-only is the contract."""
    r = test_client.post("/auth/signup",
                         json={"email": "new@example.com", "password": "abcdefghijkl"})
    assert r.status_code == 403
    assert "invitation-only" in r.json().get("detail", "").lower()


def test_login_blocks_soft_deleted_user(db_session, test_client):
    """A user with deleted_at set cannot log in (A7)."""
    from app.models import User
    from app.auth.service import hash_password

    u = User(
        email="deleted@example.com",
        email_verified_at=datetime.utcnow(),
        password_hash=hash_password("correcthorse1234"),
        deleted_at=datetime.utcnow(),
    )
    db_session.add(u)
    db_session.commit()

    r = test_client.post("/auth/login", json={
        "email": "deleted@example.com",
        "password": "correcthorse1234",
    })
    assert r.status_code == 401


def test_session_rejected_for_soft_deleted_user(db_session, test_client):
    """A live session for a now-deleted user must 401 on /auth/me (A7)."""
    from app.models import User
    from app.auth.service import create_session, hash_password

    u = User(
        email="alive-then-dead@example.com",
        email_verified_at=datetime.utcnow(),
        password_hash=hash_password("correcthorse1234"),
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    sess = create_session(db_session, u.id)
    db_session.commit()
    sid = sess.id

    # Confirm session works pre-delete
    test_client.cookies.set("gp_session", sid)
    assert test_client.get("/auth/me").status_code == 200

    # Now soft-delete
    u.deleted_at = datetime.utcnow()
    db_session.commit()
    test_client.cookies.set("gp_session", sid)
    assert test_client.get("/auth/me").status_code == 401


def test_invitation_accept_rejects_identity_mismatch(db_session, test_client):
    """A3: signed in as alice, click invitation for bob → 409, token preserved."""
    from app.models import (
        User, OrgMembership, Tenant, ROLE_GARABYTE_ADMIN,
        VerificationToken, TOKEN_INVITATION,
    )
    from app.auth.service import create_session, hash_password, mint_token

    t = Tenant(slug="a3", name="A3", sector="other")
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    admin = User(email="admin-a3@example.com",
                 email_verified_at=datetime.utcnow(),
                 password_hash=hash_password("correcthorse1234"))
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    db_session.add(OrgMembership(user_id=admin.id, org_id=t.id, role=ROLE_GARABYTE_ADMIN))
    alice = User(email="alice-a3@example.com",
                 email_verified_at=datetime.utcnow(),
                 password_hash=hash_password("correcthorse1234"))
    db_session.add(alice)
    db_session.commit()
    db_session.refresh(alice)
    sess = create_session(db_session, alice.id)
    db_session.commit()

    plain = mint_token(
        db_session, purpose=TOKEN_INVITATION, email="bob-a3@example.com",
        ttl=timedelta(days=7),
        payload={"org_id": t.id, "role": "org_admin",
                 "dimension_ids": None, "inviter_user_id": admin.id},
    )
    db_session.commit()

    test_client.cookies.set("gp_session", sess.id)
    r = test_client.post(
        "/auth/invitations/accept",
        json={"token": plain, "name": "Hijack", "password": "correcthorse1234"},
    )
    assert r.status_code == 409

    # Token must NOT be consumed (rollback worked).
    tok = (db_session.query(VerificationToken)
           .filter(VerificationToken.purpose == TOKEN_INVITATION,
                   VerificationToken.email == "bob-a3@example.com")
           .first())
    assert tok.consumed_at is None
    # No bob created.
    assert db_session.query(User).filter(User.email == "bob-a3@example.com").count() == 0


def test_invitation_validates_dimension_ids(db_session, test_client):
    """Audit fix: dimension_ids in invitation payload must reference real dims."""
    from app.models import User, OrgMembership, Tenant, ROLE_GARABYTE_ADMIN
    from app.auth.service import create_session, hash_password

    t = Tenant(slug="dim-val", name="DV", sector="other")
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    admin = User(email="admin-dv@example.com",
                 email_verified_at=datetime.utcnow(),
                 password_hash=hash_password("correcthorse1234"))
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    db_session.add(OrgMembership(user_id=admin.id, org_id=t.id, role=ROLE_GARABYTE_ADMIN))
    db_session.commit()
    sess = create_session(db_session, admin.id)
    db_session.commit()

    test_client.cookies.set("gp_session", sess.id)
    r = test_client.post("/auth/invitations", json={
        "email": "victim@example.com",
        "org_id": t.id,
        "role": "section_contributor",
        "dimension_ids": ["d99", "../etc/passwd"],
    })
    assert r.status_code == 400
    assert "Unknown dimension" in r.json().get("detail", "")
