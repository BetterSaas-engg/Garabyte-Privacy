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

from .models import Base


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
    """Create all tables. Safe to call repeatedly -- idempotent."""
    Base.metadata.create_all(bind=engine)
