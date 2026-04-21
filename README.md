# Garabyte Privacy Health Check

A SaaS platform that assesses an organization's privacy program maturity across 8 dimensions, produces a prioritized gap report, and maps findings to specific regulations (PIPEDA, Quebec Law 25, CASL, GDPR, CCPA, AIDA).

Co-designed with Garabyte Consulting.

## Architecture

- **Backend:** FastAPI (Python) — scoring engine, rules library, REST API
- **Frontend:** Next.js — client questionnaire, dashboard, consultant console
- **Rules library:** YAML files — privacy content authored with Garabyte
- **Database:** Postgres (production) / SQLite (local dev)
- **Deploy:** Railway (backend + DB), Vercel (frontend)

## Project structure

See `docs/architecture.md` for detail.

## Status

Under active development. See git log for progress.
