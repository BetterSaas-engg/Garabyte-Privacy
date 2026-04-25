# Architecture

Reference for contributors. Describes how the pieces fit together and where things go.

## Repository layout

```
Garabyte-Privacy/
├── backend/                # FastAPI service
│   ├── app/
│   │   ├── main.py         # FastAPI app, CORS, route mounting
│   │   ├── config.py       # Pydantic-settings (env vars)
│   │   ├── database.py     # SQLAlchemy engine, session factory
│   │   ├── seed.py         # Demo tenant seeder (3 sectors)
│   │   ├── models/         # SQLAlchemy ORM (Tenant, Assessment, Response)
│   │   ├── schemas/        # Pydantic request/response shapes
│   │   ├── routes/         # FastAPI route handlers
│   │   └── services/
│   │       ├── rules_loader.py   # YAML → in-memory RulesLibrary
│   │       └── scoring.py        # score_assessment() — pure function
│   ├── alembic/            # DB migrations (env.py uses app's metadata)
│   ├── alembic.ini         # Alembic config (sqlalchemy.url is dynamic)
│   ├── test_*.py           # Smoke tests, run as scripts (not pytest yet)
│   ├── requirements.txt    # Pinned-ish deps
│   └── Dockerfile          # Railway build
│
├── frontend/               # Next.js 14 (App Router)
│   ├── app/                # Routes (only `/` and `/tenants/[slug]` today)
│   ├── components/         # Read-only display components
│   ├── lib/
│   │   ├── api.ts          # Typed API client wrappers
│   │   └── types.ts        # Frontend mirror of backend Pydantic shapes
│   ├── next.config.mjs
│   └── tailwind.config.ts  # Custom Garabyte palette
│
├── rules/                  # YAML rules library — authored with Garabyte
│   ├── d1_governance_accountability.yaml
│   ├── d2_data_inventory.yaml
│   ├── ... (8 dimensions)
│   └── d8_privacy_by_design_ai.yaml
│
├── docs/
│   ├── architecture.md     # This file
│   └── privacy.md          # Our own data-handling posture
│
├── .github/
│   ├── workflows/ci.yml    # PR + push CI
│   └── dependabot.yml
│
├── README.md
├── railway.toml            # Backend deploy config
└── .gitignore
```

## Backend

### Request flow

```
HTTP → uvicorn → FastAPI router → Pydantic schema validation
     → SQLAlchemy session (per-request via Depends(get_db))
     → response model serialization → HTTP
```

### Modules

`app/main.py` is the composition root. It loads the rules library at startup (one-time YAML parse), builds the FastAPI app, configures CORS, calls `init_db()`, and mounts the route modules.

`app/config.py` holds `Settings` (Pydantic-settings). Reads env vars, fails fast if anything required is missing. Singleton: `from .config import settings`.

`app/database.py` resolves `DATABASE_URL` (SQLite default for dev, Postgres in production via Railway), creates the SQLAlchemy engine + session factory, exports `get_db` for FastAPI dependency injection.

`app/models/` is one file per ORM model. `Tenant` 1—N `Assessment` 1—N `Response`. Cascade is configured (`cascade="all, delete-orphan"`) so deleting a tenant deletes everything beneath it. The cascade is currently never triggered because no DELETE route exists yet (audit H4).

`app/schemas/` is the Pydantic API surface. Schemas are deliberately separate from ORM models so the API contract can evolve independently of the storage shape.

`app/routes/` is split by resource: `tenants.py`, `assessments.py`, `rules.py`. `assessments.py` exports two routers because creation lives under `/tenants/{id}/assessments` while lifecycle lives under `/assessments/{id}`.

`app/services/` is pure logic. `rules_loader.py` loads + validates the YAML library. `scoring.py` takes a `RulesLibrary` plus a `dict[question_id, value]` and returns an `AssessmentResult`. Both modules are testable without the DB or HTTP layer.

### Scoring engine

Public entry: `score_assessment(rules, responses, evidence_provided=None) -> AssessmentResult`.

```
score_assessment
├── validate every response (known qid, int 0-4, no bools)
├── for each dimension:
│   ├── _score_dimension → DimensionScore (with confidence + evidence_coverage)
│   └── _generate_gaps → matching GapRemediation entries (per dimension's library)
├── compute overall score (weighted mean over confidence != "none" dims)
├── sort gaps (severity rank, then score asc)
└── stamp result with rules_version + schema_version + assessed_at
```

Key invariants:
- Validates inputs at entry; raises on contract violations rather than silently coercing.
- A dimension with `confidence == "none"` (less than 40% of questions answered) is excluded from the overall score and produces no gap findings — the partial-completion bug from audit C4.
- Evidence coverage is per-dimension; the engine doesn't require evidence, it just reports what fraction of answers have it.
- Triggers are structured (`score_min`, `score_max`, `min_inclusive`, `max_inclusive`) on `GapRemediation`. The legacy regex-string format is rejected by the loader.
- Maturity labels come from `Dimension.maturity_levels` (each YAML defines its own); `RulesLibrary.validate()` enforces that all dimensions agree on the label text.

### Rules library

Each YAML in `rules/` is one dimension. Schema (loosely):

```yaml
dimension_id: d1
dimension_name: Governance & Accountability
dimension_weight: 0.15            # all 8 must sum to 1.0
description: ...

regulatory_anchors:               # broad mapping
  - regulation: PIPEDA
    clauses: ["Principle 1", "s. 4.1.1"]

maturity_levels:                  # 0-4, must be all 5, labels must match other dims
  0: { label: "Ad hoc",     description: "..." }
  1: { label: "Developing", description: "..." }
  ...

questions:                        # weights within dimension must sum to 1.0
  - id: d1_q1
    text: "..."
    weight: 0.25
    evidence_prompt: "..."        # used by the UI to suggest what to attach
    regulatory_note: "..."        # surgical citation for this specific question
    options:
      - { value: 0, label: "..." }
      ...
      - { value: 4, label: "..." }

gap_remediation_library:          # which finding fires for which score range
  - severity: critical
    score_max: 1.5                # "fires when avg < 1.5" (max_inclusive defaults to false)
    finding: "..."
    recommendation: "..."
    regulatory_risk: "..."
    typical_consulting_hours: 20
    upsell_hook: "..."            # optional, used by GTM
```

To add a dimension: drop a new YAML into `rules/`, ensure dimension weights still sum to 1.0 across all files, and the loader's `validate()` will catch any structural mistakes at startup. To add a question: edit the dimension's YAML; question weights within the dimension must still sum to 1.0. **Question IDs should be treated as immutable** — renaming `d1_q3` breaks any stored result that referenced it (audit H11).

### Database

```
tenants                    assessments               responses
─────────                  ───────────               ─────────
id PK                  ┌── id PK                ┌── id PK
slug UNIQUE            │   tenant_id FK ────────┘
name                   │   label
sector                 │   status                  assessment_id FK ──┘
jurisdiction           │   overall_score           question_id
employee_count         │   overall_maturity        value (0-4)
is_demo                │   result_json (JSON)      note
created_at             │   started_at              evidence_url
                       │   completed_at            answered_at
                       └── (cascade)
```

Schema evolution uses Alembic. `init_db()` (still called at app startup) does `Base.metadata.create_all()` for fresh-dev convenience. For production schema changes:

```bash
cd backend
# 1. Edit a model in app/models/
# 2. Generate the migration
alembic revision --autogenerate -m "add foo column"
# 3. Inspect the generated file in alembic/versions/ — autogen is not perfect
# 4. Apply
alembic upgrade head
# 5. Commit both the model change and the migration file
```

If you have a pre-existing DB whose schema matches the current models but isn't tracked by Alembic yet, stamp it: `alembic stamp head`.

CI runs `alembic upgrade head` against a fresh SQLite DB plus `alembic check` (which fails if model metadata diverges from migrations). So forgetting to commit a migration alongside a model change will fail CI.

## Frontend

Next.js 14 with App Router. Today it's a read-only dashboard:

| Route | Purpose |
|---|---|
| `/` | Landing — list of tenants + score cards |
| `/tenants/[slug]` | Tenant dashboard — overall score, dimension grid, gaps, history |

There's no questionnaire UI yet — the platform is fed by `python -m app.seed`. Building the questionnaire is audit C0 and the biggest open feature.

`lib/api.ts` is the only place that talks to the backend. One typed function per endpoint, all going through a shared `apiRequest` helper that handles JSON, errors, and the `NEXT_PUBLIC_API_URL` env var.

`lib/types.ts` mirrors the backend Pydantic schemas. There's no codegen — they're maintained by hand. When you change a backend schema, change the TS type in the same PR.

## Deploy

### Backend (Railway)

`railway.toml` points to `backend/Dockerfile` (build context is project root, so `COPY backend/...` paths resolve). Railway sets `DATABASE_URL` automatically when a Postgres addon is attached.

The Dockerfile:
- `python:3.12-slim` base
- Runs as non-root UID 1000
- Healthcheck at `/health`, restart policy ON_FAILURE
- Copies `backend/app/`, `backend/alembic*`, and `rules/`

Schema migrations are **not** auto-run on container start. Run `alembic upgrade head` as a Railway release-phase step before deploying a schema change.

### Frontend (Vercel)

Vercel auto-detects Next.js. Set `NEXT_PUBLIC_API_URL` to the Railway backend URL in the Vercel project settings. No Dockerfile or vercel.json needed.

## What's intentionally not here

- **No authentication** (audit C1). All endpoints are public. Do not deploy to a customer-facing URL until this is built.
- **No tests in pytest format** — the four `test_*.py` files are bare scripts that print `[OK]`/`[FAIL]`. CI catches `[FAIL]` via grep until they're converted (audit M12).
- **No structured logging.** The audit tracks this as M13.
- **No analytics, tracking, or telemetry.** This is intentional — see `docs/privacy.md`.

For the full list of known gaps, see the latest audit document.
