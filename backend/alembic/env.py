"""
Alembic migration environment.

Reuses the app's models metadata and DATABASE_URL resolution so migrations
target exactly the same schema and database the app does. Run from the
backend/ directory:

    alembic upgrade head           # apply pending migrations
    alembic revision --autogenerate -m "msg"   # create a new migration
    alembic stamp head             # mark a pre-existing schema as up-to-date
"""

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make `app.*` importable when alembic runs from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import DATABASE_URL  # noqa: E402
from app.models import Base  # noqa: E402

config = context.config

# Inject the runtime DATABASE_URL into alembic's config so we don't need
# sqlalchemy.url duplicated in alembic.ini. This means the same env var
# the app reads also drives migrations -- no chance of drift.
config.set_main_option("sqlalchemy.url", DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emits SQL, doesn't connect)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Render SQLite-friendly migrations on SQLite; mostly relevant for
        # autogen of column types like JSON.
        render_as_batch=url.startswith("sqlite"),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to the DB)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Required for SQLite ALTER TABLE support; harmless on Postgres.
            render_as_batch=connection.dialect.name == "sqlite",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
