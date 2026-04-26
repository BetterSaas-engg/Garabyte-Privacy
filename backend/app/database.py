"""
Database connection.

Supports SQLite for local development (no setup) and Postgres in production
via the DATABASE_URL environment variable. Railway injects DATABASE_URL
automatically when a Postgres addon is attached.

Note: we use psycopg v3 (not psycopg2), so Postgres URLs use the
postgresql+psycopg:// prefix.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _resolve_database_url() -> str:
    """
    Pick the right DATABASE_URL for the current environment and normalize it
    for psycopg v3.

    - Default: local SQLite file in the backend/ folder
    - If DATABASE_URL is set (e.g. Railway), use that
    - Normalize postgres:// and postgresql:// to postgresql+psycopg://
      (Railway injects postgres://; psycopg v3 requires the explicit driver)
    """
    url = os.getenv("DATABASE_URL", "sqlite:///./garabyte_local.db")

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    return url


DATABASE_URL = _resolve_database_url()

# SQLite needs this arg for multi-threaded FastAPI; Postgres does not
connect_args = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency -- yields a session and closes it when the request
    finishes. Not used in this step, but defined now so routes in step 8
    can import it.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Bring the database schema up to the latest Alembic revision. Called
    on FastAPI startup. Idempotent; no-op if already at head.

    Why Alembic instead of `Base.metadata.create_all()`:

    create_all silently created any new model tables it found, which
    collided with subsequent `alembic upgrade head` runs (the migration
    tried to recreate tables init_db had already made, and Alembic blew
    up with "table X already exists"). Routing every startup through
    Alembic means there's exactly one path to schema changes and no
    parallel-path conflicts.

    For multi-replica deploys this should move out of app startup
    (release-phase command instead) so two boots don't race the
    migration. Single-instance Railway is fine here.
    """
    # Local imports so this module stays usable in alembic/env.py without
    # creating an import cycle.
    from pathlib import Path
    from alembic import command
    from alembic.config import Config

    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    # env.py reads DATABASE_URL itself, but be explicit to handle the
    # rare case where a worker has a different env loaded.
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    command.upgrade(cfg, "head")
