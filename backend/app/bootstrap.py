"""
Bootstrap a fresh environment with the first admin user.

Run from the backend/ directory with the venv active. Idempotent — re-running
won't create duplicates.

    # Default: dev admin with a generated password (printed to stdout)
    python -m app.bootstrap

    # Provide your own
    python -m app.bootstrap --email you@example.com --password 'a long passphrase'

    # Also create org_admin memberships for every existing demo tenant,
    # so the seeded data is reachable through the API.
    python -m app.bootstrap --seed-memberships

The bootstrap admin gets the `garabyte_admin` role. They can read every
tenant per R&P §1 (with logged elevation per C4) and create new tenants.
For customer-side admins, use the in-product invitation flow instead.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from datetime import datetime
from pathlib import Path

# Allow running both as `python -m app.bootstrap` (recommended) and as a
# bare script (`python app/bootstrap.py`) by ensuring the backend dir is on path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.service import hash_password  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.models import (  # noqa: E402
    OrgMembership,
    ROLE_GARABYTE_ADMIN,
    ROLE_ORG_ADMIN,
    Tenant,
    User,
)


# RFC 2606 reserved-for-docs domain. EmailStr accepts it; production
# deploys should pass --email with a real address.
DEFAULT_ADMIN_EMAIL = "admin@example.com"


def _ensure_user(db, *, email: str, password: str, name: str | None) -> User:
    """Create or update the bootstrap admin. Returns the User."""
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Don't overwrite an existing password silently. If you need to
        # reset it, do so explicitly via a different path.
        if user.password_hash is None:
            user.password_hash = hash_password(password)
            user.email_verified_at = datetime.utcnow()
            print(f"[OK] Updated existing user {email} with bootstrap password.")
        else:
            print(f"[OK] User {email} already exists; password unchanged.")
        return user

    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
        email_verified_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()
    print(f"[OK] Created user {email} (id={user.id})")
    return user


def _ensure_garabyte_admin_membership(db, user: User) -> None:
    """
    The garabyte_admin role isn't tied to a customer org — but the schema
    stores roles in OrgMembership. Convention: membership row with org_id
    pointing at a sentinel `_garabyte_internal` tenant if it exists, else
    the membership is implied by the absence of any customer-side rows.

    For Phase 3, we encode it as a membership against the first tenant in
    the database (any tenant works since the role itself grants global
    access via ensure_membership's elevation path). If no tenants exist,
    we create the membership against tenant_id NULL via raw SQL... actually
    no, the column is NOT NULL.

    Pragmatic answer: pick any tenant if one exists, or skip the
    membership row entirely. The auth code's elevation path checks for
    `m.role == ROLE_GARABYTE_ADMIN` across all the user's memberships, so
    a single such row anywhere is sufficient. If no tenants exist, the
    user still has elevation but only as soon as a tenant is created.

    Cleaner long-term: split User into a `is_garabyte_admin: bool` column
    or a separate platform_roles table. Phase 5 design problem.
    """
    existing = (
        db.query(OrgMembership)
        .filter(
            OrgMembership.user_id == user.id,
            OrgMembership.role == ROLE_GARABYTE_ADMIN,
        )
        .first()
    )
    if existing:
        print(f"[OK] Garabyte admin membership already present (org_id={existing.org_id})")
        return

    any_tenant = db.query(Tenant).order_by(Tenant.id.asc()).first()
    if not any_tenant:
        # First-deploy chicken-and-egg: the garabyte_admin role can't be
        # anchored without a tenant, but the API path for creating
        # tenants requires garabyte_admin. Break the cycle by spinning
        # up a sentinel internal tenant — the admin can rename/repurpose
        # or ignore it once real customer tenants start coming in.
        any_tenant = Tenant(
            slug="_garabyte_internal",
            name="Garabyte (internal)",
            sector="other",
            jurisdiction="N/A",
            is_demo=0,
        )
        db.add(any_tenant)
        db.flush()
        print(
            f"[OK] Created sentinel tenant '_garabyte_internal' to anchor "
            f"the garabyte_admin role (id={any_tenant.id})."
        )

    db.add(OrgMembership(
        user_id=user.id,
        org_id=any_tenant.id,
        role=ROLE_GARABYTE_ADMIN,
    ))
    # Flush so the new row is visible to subsequent queries in the same
    # session (SessionLocal is autoflush=False).
    db.flush()
    print(f"[OK] Anchored garabyte_admin role on tenant '{any_tenant.slug}'")


def _seed_org_admin_memberships(db, user: User) -> None:
    """For every demo tenant, give the bootstrap user an org_admin membership.
    Useful in dev so the seeded data is reachable through the API.

    Tenants already used as the garabyte_admin anchor are skipped — schema
    allows one role per (user, org) pair, and garabyte_admin already grants
    elevated access via ensure_membership."""
    tenants = db.query(Tenant).filter(Tenant.is_demo == 1).all()
    added = 0
    skipped_anchor = 0
    for t in tenants:
        existing = (
            db.query(OrgMembership)
            .filter(OrgMembership.user_id == user.id, OrgMembership.org_id == t.id)
            .first()
        )
        if existing:
            if existing.role == ROLE_GARABYTE_ADMIN:
                skipped_anchor += 1
            continue
        db.add(OrgMembership(
            user_id=user.id,
            org_id=t.id,
            role=ROLE_ORG_ADMIN,
        ))
        added += 1
    if added:
        print(f"[OK] Added org_admin memberships on {added} demo tenant(s)")
    if skipped_anchor:
        print(f"[OK] Skipped {skipped_anchor} tenant(s) already used as garabyte_admin anchor")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap a Garabyte admin user.")
    parser.add_argument("--email", default=None,
                        help=f"Email for the bootstrap admin. "
                             f"Falls back to $BOOTSTRAP_ADMIN_EMAIL, then "
                             f"{DEFAULT_ADMIN_EMAIL} in dev only.")
    parser.add_argument("--password", default=None,
                        help="Password. Falls back to $BOOTSTRAP_ADMIN_PASSWORD. "
                             "In dev only, a random one is generated and printed.")
    parser.add_argument("--name", default="Garabyte admin",
                        help="Display name for the bootstrap admin")
    parser.add_argument("--seed-memberships", action="store_true",
                        help="Also grant org_admin on every demo tenant (dev convenience)")
    parser.add_argument("--if-env", action="store_true",
                        help="Only run if BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD "
                             "are set; otherwise no-op exit 0. Use this in Railway's "
                             "preDeployCommand so deploys don't fail when the operator "
                             "hasn't provisioned bootstrap creds yet.")
    args = parser.parse_args()

    # Pull from env vars when CLI flags weren't passed. Railway operators
    # set these in the service Variables tab and never touch the shell.
    email = args.email or os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "").strip() or None
    password = args.password or os.environ.get("BOOTSTRAP_ADMIN_PASSWORD") or None

    # --if-env mode: silently skip when env vars aren't provisioned. This
    # lets the preDeployCommand chain `alembic upgrade head && bootstrap`
    # without failing the deploy on services that haven't set the vars.
    if args.if_env and not (email and password):
        print(
            "[skip] --if-env set but BOOTSTRAP_ADMIN_EMAIL or "
            "BOOTSTRAP_ADMIN_PASSWORD missing. Set both in the service "
            "Variables tab to auto-create the admin on next deploy."
        )
        return

    # Apply dev defaults only when not in production.
    is_prod = os.environ.get("APP_ENV", "").strip().lower() == "production"
    if not email:
        email = DEFAULT_ADMIN_EMAIL

    # Production hardening: refuse the convenience defaults that are fine in
    # dev but unsafe in prod (admin@example.com fallback email, generated
    # password printed to stdout, demo-tenant memberships).
    if is_prod:
        if email == DEFAULT_ADMIN_EMAIL:
            raise SystemExit(
                "Refusing to bootstrap with the default email under "
                "APP_ENV=production. Set BOOTSTRAP_ADMIN_EMAIL or pass --email."
            )
        if not password:
            raise SystemExit(
                "Refusing to auto-generate a password under APP_ENV=production "
                "(would be printed to aggregated logs). "
                "Set BOOTSTRAP_ADMIN_PASSWORD or pass --password."
            )
        if args.seed_memberships:
            raise SystemExit(
                "Refusing --seed-memberships under APP_ENV=production "
                "(this flag attaches the bootstrap user to demo tenants)."
            )

    init_db()  # ensure tables exist (idempotent)

    password_was_generated = password is None
    password = password or secrets.token_urlsafe(18)

    db = SessionLocal()
    try:
        user = _ensure_user(db, email=email, password=password, name=args.name)
        _ensure_garabyte_admin_membership(db, user)
        if args.seed_memberships:
            _seed_org_admin_memberships(db, user)
        db.commit()
    finally:
        db.close()

    if password_was_generated:
        print(
            f"\n[OK] Bootstrap complete.\n"
            f"     email:    {email}\n"
            f"     password: {password}\n"
            f"     (Save this -- it isn't recoverable.)"
        )
    else:
        print(f"\n[OK] Bootstrap complete for {email}")


if __name__ == "__main__":
    main()
