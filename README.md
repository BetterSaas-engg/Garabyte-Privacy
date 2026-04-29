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
pytest -ra
```

CI runs `pytest` plus a "legacy smoke" pass over the older `test_*.py` scripts on every PR. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Deployment (Railway + Vercel)

The intended deploy targets are **Railway** (backend + Postgres) and
**Vercel** (Next.js frontend), driven from a private GitHub repo.
Both platforms read config from files in this repo
([railway.toml](railway.toml), [backend/Dockerfile](backend/Dockerfile),
[vercel.json](vercel.json)) so most of the setup is just clicks.

### 1. Push to GitHub

Standard `git remote add origin … && git push -u origin main`. Repo is
expected to be **private** — `backend/app/seed.py` is committed for
local-dev convenience and is guarded against running with
`APP_ENV=production`, but a private repo keeps the synthetic-tenant
fixtures off the public internet.

### 2. Deploy the backend on Railway

1. New Project → "Deploy from GitHub repo" → pick this repo.
2. Railway auto-detects [railway.toml](railway.toml), which points at
   [backend/Dockerfile](backend/Dockerfile). No build config needed.
3. Add a **Postgres** add-on. Railway exposes its connection string as
   the `DATABASE_URL` env var on the backend service automatically.
4. Set the env vars in the table below.
5. Deploy. Railway runs the `preDeployCommand` from
   [railway.toml](railway.toml) — a separate, short-lived container
   that runs [backend/app/migrate.py](backend/app/migrate.py) (smart
   migration: fresh DB → `alembic upgrade head`; orphaned schema with
   tables but no `alembic_version` → stamp head and adopt; managed
   DB → normal upgrade) and then idempotently creates the first admin
   user from the bootstrap env vars (see step 6 below). Only after
   that completes does the web container start serving uvicorn. This
   keeps web startup instant and prevents the healthcheck from racing
   the migration runtime.
6. Bootstrap the first admin via env vars (no shell needed). In Railway →
   backend service → Variables, add:

   | Variable | Value |
   |---|---|
   | `BOOTSTRAP_ADMIN_EMAIL` | the email you'll log in with |
   | `BOOTSTRAP_ADMIN_PASSWORD` | a long passphrase (16+ chars) |

   Redeploy. The preDeploy step picks them up and creates the
   `garabyte_admin` user. The script is idempotent — if the user
   already exists it leaves the password alone. Once you've logged
   in successfully, **delete both variables from Railway** so the
   plaintext password isn't sitting in your environment forever.
   Change the password from inside the app via password reset.

   (If you'd rather bootstrap from a shell instead of env vars,
   `python -m app.bootstrap --email ... --password ...` still works.)

#### Required Railway env vars

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | (auto from Postgres add-on) | Don't set by hand. |
| `APP_ENV` | yes | `production` | Activates the seed/bootstrap guards. |
| `LOG_LEVEL` | no | `INFO` | |
| `CORS_ALLOWED_ORIGINS` | yes | `https://app.garabyte.com` | Comma-separated. Include the Vercel URL. |
| `FRONTEND_BASE_URL` | yes | `https://app.garabyte.com` | Used in invite/reset email links. |
| `EMAIL_BACKEND` | yes | `smtp` | Default `stdout` is dev-only. |
| `SMTP_HOST` | if smtp | `smtp.postmarkapp.com` | |
| `SMTP_PORT` | if smtp | `587` | |
| `SMTP_USER` | if smtp | … | |
| `SMTP_PASSWORD` | if smtp | … | |
| `EMAIL_FROM` | yes | `Garabyte Privacy <no-reply@garabyte.com>` | The `From:` domain should match `SMTP_USER`'s domain so DMARC doesn't add "via …" decorations. |
| `EMAIL_REPLY_TO` | no | `support@garabyte.com` | |
| `EVIDENCE_STORAGE_DIR` | no | `./evidence_files` | See "Known limitations" below. |
| `EVIDENCE_MAX_BYTES` | no | `10485760` | 10 MB default. |

The full list with defaults lives in [backend/.env.example](backend/.env.example).

### 3. Deploy the frontend on Vercel

1. New Project → import the same GitHub repo.
2. **Set the Root Directory to `frontend`** in the project setup screen
   (or under Settings → General → Root Directory after import). This is
   required — the repo is a monorepo and Vercel needs to know which
   subdirectory holds the Next.js app. Once set, Vercel auto-detects
   Next.js, runs `npm ci` + `npm run build` from `frontend/`, and serves
   `frontend/.next`. Node version is pinned to 20 via
   [frontend/.nvmrc](frontend/.nvmrc).
3. [vercel.json](vercel.json) at the repo root pins framework + build
   commands and disables Vercel preview deployments for `dependabot/*`
   branches (silences a dozen failing previews per dependency bump).
4. Set the one required env var:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-railway-app>.up.railway.app` |

5. Deploy. Once the Vercel URL is live, go back to Railway and add it
   to `CORS_ALLOWED_ORIGINS` and `FRONTEND_BASE_URL`, then redeploy the
   backend.

### 4. Smoke-test

```bash
curl https://<your-railway-app>.up.railway.app/health
# → {"status":"ok", ...}
```

Then in the browser: sign in as the bootstrap admin → create a test
tenant → invite a colleague (or yourself) → accept the invite → run
an assessment to completion → score it. That flow exercises every
major code path.

### Known limitations / pre-launch TODO

- **Evidence storage is ephemeral.** Uploaded evidence files write to
  the container's local disk (`./evidence_files`). Railway's filesystem
  doesn't persist across redeploys, so files vanish on every push.
  Acceptable for early-stage / demo use; before real customer evidence
  starts flowing, either mount a Railway persistent volume at
  `/app/evidence_files` or swap `services/evidence_storage.py` for an
  object-store backend (S3/R2).
- **Migrations.** Run via Railway's `preDeployCommand` (see
  [railway.toml](railway.toml)) in a separate container before the web
  container boots. Multi-replica safe (only one preDeploy runs per
  deploy) and decoupled from the healthcheck timeout. Locally,
  `init_db()` still auto-applies migrations on uvicorn startup so dev
  doesn't have to remember `alembic upgrade head` after every pull.

- **Recovering a partial / orphaned schema.** If a previous deploy
  left the DB with application tables but no `alembic_version` row,
  [backend/app/migrate.py](backend/app/migrate.py) detects this and
  refuses to silently lie about the schema state. Two recovery paths,
  both runnable from the Railway dashboard without shell access:

  - **If the existing tables match a known revision** (e.g. only the
    baseline tables `tenants`/`assessments`/`responses`): set
    `MIGRATE_STAMP_REVISION` on the backend service to that revision
    (e.g. `b54d2f396450`) and redeploy. The script stamps that
    revision and then `alembic upgrade head` applies every subsequent
    migration. Remove the variable after the deploy succeeds.
  - **If the existing tables hold no real data**: drop them in the
    Postgres console (Railway dashboard → Postgres add-on → Data tab,
    or `psql`) and redeploy. `migrate.py` will see a fresh DB and run
    `alembic upgrade head` from scratch.
- **`backend/app/seed.py`** is a dev/demo helper and refuses to run
  with `APP_ENV=production`. It stays in the repo for local dev only.

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
