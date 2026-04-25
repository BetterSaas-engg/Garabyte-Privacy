"""
App configuration -- reads environment variables and exposes them cleanly.

Using pydantic-settings so config is validated on startup: if a required
env var is missing or malformed, the app refuses to start rather than
failing at request time. Fail fast.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment (and .env file if present)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # don't fail on unrecognized vars
    )

    app_env: str = "development"
    log_level: str = "INFO"

    # Comma-separated list of allowed CORS origins
    # Default covers local Next.js dev server
    cors_allowed_origins: str = "http://localhost:3000"

    # Base URL the frontend is served from. Used to build absolute links in
    # the email bodies for verification, magic-link, password-reset, and
    # invitation flows. In production, set FRONTEND_BASE_URL via env.
    frontend_base_url: str = "http://localhost:3000"

    # DATABASE_URL is read directly by app/database.py, not here.

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


# Singleton -- import this, don't create new instances
settings = Settings()
