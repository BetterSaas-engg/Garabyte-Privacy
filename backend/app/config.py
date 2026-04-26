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

    # ---- Email transport (Phase 7) ---------------------------------------
    # Drives which sender backend send_email() routes through:
    #   "stdout"  — print to uvicorn terminal (default; safe for dev)
    #   "smtp"    — connect to smtp_host/port with STARTTLS and send for real
    # Any other value raises at startup.
    email_backend: str = "stdout"

    # SMTP credentials. Only consulted when email_backend == "smtp" — leaving
    # them blank in dev is fine. Required values fail loudly in main.py at
    # startup when the smtp backend is selected.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_starttls: bool = True

    # The visible From: header. The DMARC-aligned identity should match the
    # SMTP user's domain or the customer will see "via …" decorations.
    email_from: str = "Garabyte Privacy <no-reply@garabyte.example>"
    email_reply_to: str = ""

    # ---- Evidence file storage (Phase 10) --------------------------------
    # Local-disk path where uploaded evidence files are persisted. Defaults
    # to backend/evidence_files/ relative to the backend root. Production
    # should swap the storage backend (services/evidence_storage.py) for
    # an object store rather than mounting a giant volume — but the local
    # backend is fine for dev and small deployments.
    evidence_storage_dir: str = "./evidence_files"
    # Hard caps enforced at upload time.
    evidence_max_bytes: int = 10 * 1024 * 1024  # 10 MB

    # DATABASE_URL is read directly by app/database.py, not here.

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


# Singleton -- import this, don't create new instances
settings = Settings()
