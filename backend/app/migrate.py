"""
Smart entry point for Railway's preDeployCommand.

Three possible database states; this script picks the right action for each:

1. Fresh DB (no tables at all)
   -> alembic upgrade head. Creates everything from scratch.

2. Managed DB (alembic_version present, with a row)
   -> alembic upgrade head. Applies any new migrations; no-op if at head.

3. Orphaned schema (app tables exist, alembic_version missing or empty)
   -> alembic stamp head, then no upgrade.
   This recovers from prior deploys that populated the schema via
   Base.metadata.create_all() or a partial migration without
   committing the alembic_version row. The stamp brings the existing
   schema under alembic management without touching its data.

   Safety net: we only stamp when EVERY expected model table is
   already present. If any are missing, the schema is partial and we
   fail loudly rather than silently lying about its state -- the
   operator needs to decide how to reconcile.
"""

from __future__ import annotations

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
    if has_alembic_table:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).first()
        has_alembic_row = row is not None

    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    if not app_tables and not has_alembic_table:
        print("[migrate] Fresh DB. Running alembic upgrade head.")
        command.upgrade(cfg, "head")
        return

    if has_alembic_row:
        print(f"[migrate] Managed DB at revision {row[0]}. Running alembic upgrade head.")
        command.upgrade(cfg, "head")
        return

    # Orphaned: app tables exist but alembic isn't tracking them.
    missing = expected - app_tables
    if missing:
        raise SystemExit(
            "[migrate] Cannot auto-adopt: the schema has app tables but "
            "is missing some that the current models declare:\n"
            f"  missing: {sorted(missing)}\n"
            f"  present: {sorted(app_tables)}\n"
            "This indicates a partial schema, not an old create_all() snapshot. "
            "Reconcile manually: either drop the partial tables and let "
            "alembic upgrade head rebuild, or stamp to a specific older "
            "revision that matches what's there."
        )

    extra = app_tables - expected
    if extra:
        # Not fatal — there might be platform tables (e.g. Postgres extensions)
        # we don't know about. Just announce.
        print(f"[migrate] Note: extra tables not declared in models: {sorted(extra)}")

    print(
        f"[migrate] Orphaned schema detected: {len(app_tables)} app tables "
        f"present, no alembic_version row. Stamping head to adopt."
    )
    command.stamp(cfg, "head")
    print("[OK] Stamped to head. Future deploys will run normal migrations.")


if __name__ == "__main__":
    main()
