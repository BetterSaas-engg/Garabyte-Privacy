"""
FastAPI application entry point.

Run locally with:
    uvicorn app.main:app --reload --port 8001

Visit:
    http://localhost:8001/health  -> health check
    http://localhost:8001/docs    -> interactive API docs
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .services.rules_loader import load_rules_library
from .routes import rules as rules_routes
from .routes import tenants as tenants_routes
from .routes import assessments as assessments_routes


# Resolve rules directory — works in both local dev and Docker container
_LOCAL_RULES = Path(__file__).parent.parent.parent / "rules"
_DOCKER_RULES = Path(__file__).parent.parent / "rules"
RULES_DIR = _LOCAL_RULES if _LOCAL_RULES.exists() else _DOCKER_RULES
RULES = load_rules_library(RULES_DIR)


app = FastAPI(
    title="Garabyte Privacy Health Check",
    version="0.1.0",
    description=(
        "Privacy program maturity assessment platform. "
        "Built in partnership with Garabyte Consulting."
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "service": "garabyte-health-check",
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "environment": settings.app_env,
        "dimensions_loaded": len(RULES.dimensions),
        "total_questions": sum(len(d.questions) for d in RULES.dimensions),
    }


# Mount the route modules. Note assessments has TWO routers because
# creation lives under /tenants/{id}/assessments while lifecycle lives
# under /assessments/{id}.
app.include_router(rules_routes.router)
app.include_router(tenants_routes.router)
app.include_router(assessments_routes.tenants_router)
app.include_router(assessments_routes.assessments_router)
