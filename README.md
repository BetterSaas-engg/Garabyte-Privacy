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

Under active development. The current state and roadmap are tracked outside this README; ask before assuming a feature is ready for production. The frontend is currently read-only — there is no questionnaire UI yet.

See [docs/privacy.md](docs/privacy.md) for the product's own privacy posture.
