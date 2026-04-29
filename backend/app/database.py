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
    Bring the database schema up to the latest Alembic revision when
    we're in dev/test. In production (APP_ENV=production), this is a
    no-op — Railway's preDeployCommand runs `alembic upgrade head` in
    a separate ephemeral container before the web container starts.

    Why migrations don't run from this hook in production:

    Running migrations inside the FastAPI startup event blocks uvicorn
    from serving requests until `alembic upgrade head` returns. On a
    cold Postgres with a dozen+ migrations to apply, this can exceed
    Railway's healthcheck window — the container is killed mid-migration,
    transactional DDL rolls back, and on restart the same race repeats.
    Splitting migrations into a preDeploy container makes web-container
    boot instant and gives the migration container as long as it needs.

    Why Alembic and not `Base.metadata.create_all()`:

    create_all silently produced any new model tables it found, which
    later collided with `alembic upgrade head` ("table X already
    exists"). Routing every startup through Alembic means exactly one
    path to schema changes and no parallel-path conflicts.
    """
    if os.environ.get("APP_ENV", "").strip().lower() == "production":
        # Railway preDeployCommand handles migrations; the web container
        # boots clean and answers /health immediately.
        return

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
