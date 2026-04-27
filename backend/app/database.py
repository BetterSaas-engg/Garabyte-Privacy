"""
Database connection.

Supports SQLite for local development (no setup) and Postgres in production
via the DATABASE_URL environment variable. Railway injects DATABASE_URL
automatically when a Postgres addon is attached.

Note: we use psycopg v3 (not psycopg2), so Postgres URLs use the
postgresql+psycopg:// prefix.
"""

import os

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
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


# SQLite ignores ondelete=CASCADE FK constraints unless this pragma is set
# per-connection. Postgres enforces FKs natively, so this listener fires
# but the EXEC is a no-op on the postgres dialect — guarded for safety.
@event.listens_for(Engine, "connect")
def _enable_sqlite_fks(dbapi_connection, _connection_record):
    if engine.dialect.name != "sqlite":
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


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

    Multi-replica safety (audit A10):

    On Postgres we wrap the upgrade in a session-level advisory lock
    (`pg_advisory_lock`). The first replica acquires it and runs the
    upgrade; later replicas booting at the same time block until the
    lock releases, then no-op because the schema is already at head.
    The lock ID is a fixed arbitrary 64-bit constant tied to this
    application; it doesn't conflict with any other locks Postgres
    might use.

    On SQLite the lock is a no-op — there's only one process accessing
    the file at a time in dev anyway.

    The CORRECT long-term fix is to move migrations out of app startup
    entirely (Railway "release" command or equivalent). The advisory
    lock is the next-best thing for the current single-binary deploy.
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

    if engine.dialect.name == "postgresql":
        # 64-bit signed int; arbitrary but constant. Two replicas booting
        # the same image use the same lock ID and serialize.
        lock_id = 8439_2026_0427_0001
        with engine.begin() as conn:
            from sqlalchemy import text
            conn.execute(text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": lock_id})
            try:
                command.upgrade(cfg, "head")
            finally:
                conn.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id})
    else:
        command.upgrade(cfg, "head")
