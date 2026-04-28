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
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .auth.rate import limiter
from .config import settings
from .database import init_db
from .services.rules_loader import load_rules_library
from .auth import routes as auth_routes
from .routes import rules as rules_routes
from .routes import tenants as tenants_routes
from .routes import assessments as assessments_routes
from .routes import admin as admin_routes
from .routes import share_links as share_links_routes
from .routes import evidence as evidence_routes
from .routes import access_requests as access_requests_routes


# Resolve rules directory — works in both local dev and Docker container
_LOCAL_RULES = Path(__file__).parent.parent.parent / "rules"
_DOCKER_RULES = Path(__file__).parent.parent / "rules"
RULES_DIR = _LOCAL_RULES if _LOCAL_RULES.exists() else _DOCKER_RULES
RULES = load_rules_library(RULES_DIR)


app = FastAPI(
    title="Garabyte Privacy Health Check",
    version="0.1.0",
    description=(
        "Privacy program maturity assessment platform — "
        "Garabyte's tool for scoring client privacy programs against "
        "PIPEDA, Quebec Law 25, CASL, GDPR, CCPA, and Canada's anticipated AIDA."
    ),
)


# Hook the rate limiter into the app: store on state for per-route decorators
# to find, register the 429 handler, and add the middleware that enforces
# default_limits on every request.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


# CSRF defense — every mutating request must carry X-Requested-With.
# That header is non-simple under CORS, so it forces a preflight; the
# preflight is gated by allow_origins (not "*"), so a third-party site
# can't fire the request even with a stolen cookie. Defense-in-depth on
# top of SameSite=Lax on the session cookie. The only routes that mutate
# without this header are the public share-link reads (GET) and the
# auth flows (which receive the header from our own SPA).
@app.middleware("http")
async def require_xrw_on_mutations(request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        # Allow OpenAPI-doc CSRF-equivalent paths (browser tests via /docs)
        # AND the OPTIONS preflights handled by CORSMiddleware above.
        if request.headers.get("x-requested-with") != "garabyte":
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Missing X-Requested-With header"},
            )
    return await call_next(request)


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
app.include_router(auth_routes.router)
app.include_router(rules_routes.router)
app.include_router(tenants_routes.router)
app.include_router(assessments_routes.tenants_router)
app.include_router(assessments_routes.assessments_router)
app.include_router(assessments_routes.findings_router)
app.include_router(assessments_routes.consultant_router)
app.include_router(admin_routes.router)
app.include_router(share_links_routes.router)
app.include_router(evidence_routes.router)
app.include_router(access_requests_routes.router)
