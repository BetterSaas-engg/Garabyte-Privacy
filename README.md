# Garabyte Privacy Health Check

A SaaS platform that assesses an organization's privacy program maturity across 8 dimensions, produces a prioritized gap report, and maps findings to specific regulations (PIPEDA, Quebec Law 25, CASL, GDPR, CCPA, AIDA).

Co-designed with Garabyte Consulting.

## Architecture

- **Backend:** FastAPI (Python) — scoring engine, rules library, REST API
- **Frontend:** Next.js — client questionnaire, dashboard, consultant console
- **Rules library:** YAML files — privacy content authored with Garabyte
- **Database:** Postgres (production) / SQLite (local dev)
- **Deploy:** Railway (backend + DB), Vercel (frontend)

See [docs/architecture.md](docs/architecture.md) for detail.

## Quickstart

### Prerequisites

- Python 3.12 (must match the Dockerfile and CI matrix)
- Node 20+
- Git

### Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: copy env defaults; the SQLite default works without this
cp .env.example .env

# Apply schema (uses Alembic — see docs/architecture.md for the workflow)
alembic upgrade head

# Populate three synthetic demo tenants
python -m app.seed

# Create the bootstrap admin user + memberships on the demo tenants.
# Prints a generated password unless you pass --password.
python -m app.bootstrap --seed-memberships

# Run the API
uvicorn app.main:app --reload --port 8001
```

API docs: <http://localhost:8001/docs>

### Frontend

```bash
cd frontend
npm install

# Optional: copy env defaults; the http://localhost:8001 default works
cp .env.local.example .env.local

npm run dev
```

App: <http://localhost:3000>

### Tests

```bash
cd backend
.venv/bin/python test_rules_loader.py
.venv/bin/python test_scoring.py
.venv/bin/python test_database.py
.venv/bin/python test_end_to_end.py
```

CI runs the same scripts on every PR. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Status

Under active development. Phases 1–3 of the audit are complete:

- ✅ **Engine + content corrections** (label drift, partial-completion confidence, half-up rounding, structured triggers, evidence pathway, versioning fields)
- ✅ **Plumbing** (Alembic migrations, CI, evidence wired end-to-end, docs/privacy.md and docs/architecture.md)
- ✅ **Auth + ownership** (httpOnly session cookies, RBAC per [docs/roles-and-permissions.md](docs/roles-and-permissions.md), rate limiting, signup / login / magic link / password reset / invitations, IDOR fix)

A static UI mock of the consultant console is at [/consultant](frontend/app/consultant/). The customer-facing questionnaire UI (audit C0) is the next major piece; designs from the Claude Design bundle (Resume Dashboard, Question Screen, Submission Review) are still to be ported.

See [docs/privacy.md](docs/privacy.md) for the product's own privacy posture.
