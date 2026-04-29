"""
Smart entry point for Railway's preDeployCommand.

Four possible database states; this script picks the right action for each:

1. Fresh DB (no tables at all)
   -> alembic upgrade head. Creates everything from scratch.

2. Managed DB (alembic_version present, with a row)
   -> alembic upgrade head. Applies any new migrations; no-op if at head.

3. Orphaned schema, complete (app tables exist + match every model
   table, alembic_version missing/empty)
   -> alembic stamp head, then no upgrade.
   Recovers from prior deploys that populated the full schema via
   Base.metadata.create_all() without ever creating alembic_version.

4. Orphaned schema, partial (app tables exist but some are missing —
   typically because a baseline migration committed before later
   migrations were applied)
   -> requires explicit operator opt-in via MIGRATE_STAMP_REVISION
   so we don't silently lie about which revision the schema is at.
   Set the env var to the revision the existing tables correspond to;
   we stamp it, then upgrade head applies all subsequent migrations.

   Without that env var, exit 1 with a reconcile message.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

    from alembic import command
    from alembic.config import Config

    from app.database import DATABASE_URL
    from app.models import Base

    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    app_tables = existing - {"alembic_version"}

    expected = set(Base.metadata.tables.keys())

    has_alembic_table = "alembic_version" in existing
    has_alembic_row = False
    current_rev = None
    if has_alembic_table:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).first()
        if row is not None:
            has_alembic_row = True
            current_rev = row[0]

    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    if not app_tables and not has_alembic_table:
        print("[migrate] Fresh DB. Running alembic upgrade head.")
        command.upgrade(cfg, "head")
        return

    if has_alembic_row:
        print(f"[migrate] Managed DB at revision {current_rev}. Running alembic upgrade head.")
        command.upgrade(cfg, "head")
        return

    # Orphaned: app tables exist but alembic isn't tracking them.
    missing = expected - app_tables
    extra = app_tables - expected
    if extra:
        # Not fatal — there might be platform tables we don't know about.
        print(f"[migrate] Note: extra tables not declared in models: {sorted(extra)}")

    # Explicit operator override: stamp the named revision, then upgrade.
    # Use this when the schema is partial (typically baseline-only) and
    # you want to bring it under alembic management at a specific point
    # in history rather than head. Set on Railway as a service variable;
    # remove after the deploy succeeds so re-runs don't keep re-stamping.
    stamp_target = os.environ.get("MIGRATE_STAMP_REVISION", "").strip()
    if stamp_target:
        print(
            f"[migrate] MIGRATE_STAMP_REVISION={stamp_target} set. "
            f"Stamping that revision, then running upgrade head."
        )
        command.stamp(cfg, stamp_target)
        command.upgrade(cfg, "head")
        print(
            "[OK] Stamp + upgrade complete. "
            "Remove MIGRATE_STAMP_REVISION from the service variables now "
            "so future deploys don't re-stamp."
        )
        return

    if missing:
        raise SystemExit(
            "[migrate] Cannot auto-adopt: the schema has app tables but "
            "is missing some that the current models declare:\n"
            f"  missing: {sorted(missing)}\n"
            f"  present: {sorted(app_tables)}\n"
            "This is a partial schema (e.g. baseline migration committed "
            "but later phases didn't). Two ways to reconcile:\n"
            "  (a) Set MIGRATE_STAMP_REVISION on the service to the "
            "      revision the existing tables correspond to, then "
            "      redeploy. Subsequent migrations apply automatically.\n"
            "  (b) Drop the partial tables in the DB console and "
            "      redeploy — alembic upgrade head will rebuild from "
            "      scratch (only safe if the tables hold no real data).\n"
            "Common revisions: b54d2f396450 = baseline (tenants, "
            "assessments, responses); see backend/alembic/versions/ for "
            "the full revision list."
        )

    print(
        f"[migrate] Orphaned schema detected: {len(app_tables)} app tables "
        f"present, no alembic_version row. Stamping head to adopt."
    )
    command.stamp(cfg, "head")
    print("[OK] Stamped to head. Future deploys will run normal migrations.")


if __name__ == "__main__":
    main()
