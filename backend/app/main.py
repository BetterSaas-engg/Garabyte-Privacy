"""
FastAPI application entry point.

For step 8a, this only has /health and /. We'll add the real endpoints
in step 8b by mounting route modules from app/routes/.

Run locally with:
    uvicorn app.main:app --reload --port 8000

Then visit:
    http://localhost:8000/health  -> JSON health check
    http://localhost:8000/docs    -> interactive API docs
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .services.rules_loader import load_rules_library


# Load the rules library once at startup. If the YAML is malformed or
# weights don't sum to 1.0, the app refuses to start. Crash early.
RULES_DIR = Path(__file__).parent.parent.parent / "rules"
RULES = load_rules_library(RULES_DIR)


app = FastAPI(
    title="Garabyte Privacy Health Check",
    version="0.1.0",
    description=(
        "Privacy program maturity assessment platform. "
        "Built in partnership with Garabyte Consulting."
    ),
)


# CORS -- allow the frontend (on a different origin) to call the API.
# Origins list comes from config; production deploys lock this down.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Initialize database tables on app startup."""
    init_db()


@app.get("/")
def root() -> dict:
    """Tiny landing page pointing at the docs."""
    return {
        "service": "garabyte-health-check",
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
    }


@app.get("/health")
def health() -> dict:
    """
    Health check -- used by Railway and monitoring to verify the service is up.
    Also reports how much of the rules library loaded, which catches YAML
    drift early.
    """
    return {
        "status": "ok",
        "version": "0.1.0",
        "environment": settings.app_env,
        "dimensions_loaded": len(RULES.dimensions),
        "total_questions": sum(len(d.questions) for d in RULES.dimensions),
    }
