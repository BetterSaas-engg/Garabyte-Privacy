# Garabyte Privacy Health Check

Garabyte's SaaS platform for scoring a client organization's privacy program maturity across 8 dimensions, producing a prioritized gap report, and mapping findings to specific regulations (PIPEDA, Quebec Law 25, CASL, GDPR, CCPA, and Canada's anticipated AIDA).

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

## First-time production deploy

The local Quickstart above doesn't translate 1:1 to production. The
operational gotchas, in the order you'll hit them:

### 1. Apply the latest migrations

`init_db()` runs `alembic upgrade head` on backend startup, so a fresh
deploy will migrate itself. For multi-replica deploys, move this to a
release-phase command — `init_db()` has no advisory lock yet
(audit follow-up A10), so two boot-time migrations can race.

### 2. Bootstrap the first `garabyte_admin`

The seed script populates demo tenants but no users. Without a
`garabyte_admin` membership, no one can create real tenants via the API
— the only path is direct SQL. Run the bootstrap CLI on the production
backend container exactly once:

```bash
# Railway: open a shell on the backend service and run
python -m app.bootstrap --email "you@garabyte.com"

# Prints a generated password. Copy it; we don't store the plaintext
# anywhere recoverable. Change it after first login via password reset.
```

`--seed-memberships` is for local dev only — it adds `org_admin` rows
on the demo tenants. Don't pass it in production.

### 3. Configure SMTP

Default `EMAIL_BACKEND=stdout` prints invitations to the uvicorn
terminal — fine for local dev, useless in production. Set:

```
EMAIL_BACKEND=smtp
SMTP_HOST=...               # e.g. smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM="Garabyte Privacy <no-reply@your-domain>"
```

The visible `From` domain should match the `SMTP_USER`'s domain so DMARC
doesn't add "via …" decorations to invitations.

### 4. Seed (or skip the seed)

`python -m app.seed` populates three synthetic demo tenants
(`northwind-utilities`, `meridian-health`, `cascade-telecom`) marked
`is_demo=1`. Skip in production unless you want them visible in the
garabyte_admin's tenant list.

### 5. Smoke-test

After deploy:

```bash
curl https://api.your-domain/health
# → {"status":"ok", ...}

# Sign in as the bootstrap admin via the frontend, create a test tenant,
# invite a colleague to your own email, accept the invite, run an
# assessment to completion, score it. The full flow exercises every
# major code path.
```

## Status

Phases 1–10 of the audit are complete; an independent code-reviewer
pass turned up 16 follow-on findings, of which 10 are fixed (cascade
FKs, M22 jurisdiction filter, dimension validation, MIME magic-byte
check, attachment + nosniff, CSRF guard, A1–A4 audit-log/invitation
hardening). The remaining 6 are tracked in
[docs/audit-followups.md](docs/audit-followups.md).

The product is invitation-only end-to-end (self-signup is disabled).
Marketing surfaces — public landing page at `/` and a sample report at
`/sample` — are live. See [docs/privacy.md](docs/privacy.md) for the
product's own privacy posture and [docs/dsar-runbook.md](docs/dsar-runbook.md)
for the DSAR fulfillment workflow.
