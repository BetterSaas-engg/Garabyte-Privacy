# Privacy program — for the Garabyte Privacy Health Check itself

This document describes how this product handles its own customer data. It exists because a privacy-maturity SaaS will be asked the question, and the audit (finding H10) flagged that we couldn't answer it.

It is also the starting point for satisfying our own d4 (Individual Rights) and d6 (Breach Response) maturity assessments — eating our own dog food.

Sections marked **TODO (Garabyte)** require business / legal / ops input before this doc can be published externally. Everything else is grounded in what the codebase actually does.

---

## What we collect

| Data | Purpose | Where it lives | Sensitivity |
|---|---|---|---|
| Tenant metadata: name, slug, sector, jurisdiction, employee count | Display + scoping | Postgres (Railway managed) | Low — public-ish |
| Assessment responses: question_id, value (0–4), free-text note, evidence URL | The maturity score | Postgres | Medium — reveals organizational privacy posture |
| Assessment results (`result_json`): scores, gap findings, regulatory citations | Render the report | Postgres | Medium — same |
| Server access logs (uvicorn / Railway) | Operations, debugging | Railway log retention | Low — IP, path, status |

We do **not** collect:
- Names, emails, phone numbers, or other directly-identifying personal information of *individuals* at the customer organization. The product operates at organization grain.
- Cookies for tracking. There is no analytics SDK, no `gtag`, no Mixpanel, no Segment, no Sentry. ([frontend/](../frontend/) audit confirms.)
- Browser fingerprinting or device identifiers.

> **TODO (Garabyte):** Confirm the above is the entire data inventory. If the consultant workflow eventually involves contact information (e.g. who at the customer authored the assessment), this list expands and the schema does too.

## How long we keep it

> **TODO (Garabyte):** Pick a retention period. Common defaults:
>  - **Active engagement + 12 months** — typical consulting retention; supports a follow-up reassessment.
>  - **Active engagement + 24 months** — defensible if the contract references multi-year work.
>  - **Customer-controlled** — let the customer set retention per tenant; document the default if they don't.
>
> The strictest applicable jurisdiction is **Quebec Law 25 s. 23**, which requires retention only as long as needed for the purpose for which the information was collected. Pick a number that's defensible against that.

After the retention period elapses, we delete the tenant record and cascade-delete its assessments and responses (model-level cascade is already wired; the actual cron job is **TODO** — see audit H4 for the DSAR fulfillment workflow).

## How we protect it

### In transit
- Frontend ↔ backend: HTTPS, terminated at Vercel and Railway respectively.
- Backend ↔ Postgres: TLS, enforced by Railway's managed Postgres.

### At rest
- Postgres on Railway: encrypted at rest by Railway's underlying storage. ([Railway documentation](https://docs.railway.app/reference/databases) confirms this for managed Postgres.)
- Server filesystem: nothing customer-identifying is written to disk. The only file output is uvicorn's stdout, captured by Railway's log layer.

### Access control
- Currently **no authentication** is implemented (audit C1) — anyone with the API URL can read tenant data. **This is a known gap and the product is not deployed to a public URL.** Auth is the next major piece of work.
- Once auth lands: per-tenant ownership checks, audit log of read access (audit M23), no shared-tenant data.

### Logs
- Uvicorn access logs include IP, path, and status. They do **not** include request bodies. So a `POST /assessments/{id}/responses` log entry has no scores in it.
- Railway log retention: per Railway's defaults (currently 7 days for hobby, longer for paid plans — confirm based on your tier).

## Subprocessors

| Vendor | Role | Data they see | DPA |
|---|---|---|---|
| **Vercel** | Frontend hosting | Page requests; no API payloads | TODO (link) |
| **Railway** | Backend hosting + Postgres | All API requests; full database | TODO (link) |
| **GitHub** | Source code + CI | No customer data; only code + commit metadata | TODO (link) |

> **TODO (Garabyte):** Sign DPAs with Vercel and Railway. Link them above. If we add an analytics or error-tracking vendor later, they get added here too.

## Your rights

Customers can:
- **Access** their assessment data — currently via the API; once the questionnaire UI ships (audit C0), via the dashboard.
- **Correct** any inaccurate responses by updating their assessment.
- **Delete** their entire tenant and all related data (audit H4 — currently no API endpoint; coming with the DSAR workflow).
- **Export** their assessment results — currently via `GET /assessments/{id}/result` JSON; PDF export is on the roadmap.
- **Object** to specific processing — though the only processing we do is the assessment scoring itself, so this is mostly theoretical.

To exercise any of these rights, contact:
> **TODO (Garabyte):** Email address (e.g. `privacy@garabyte.ca`) + commitment to respond within 30 days (matches PIPEDA, Law 25, and GDPR).

## Breach notification

If we become aware of a confirmed breach affecting customer data, we will notify the affected customer within:
> **TODO (Garabyte):** Pick a number. Quebec Law 25 s. 3.5 requires notification "with diligence." GDPR Art. 33 mandates 72 hours to the supervisory authority (not necessarily to the customer). Industry good practice is **48–72 hours of confirmation to affected customers**.

The notification will include: what happened, what data was affected, what we're doing about it, and what the customer should do.

## Changes to this document

Material changes to data handling are reflected in this file. Each version is committed to git, so the full history is auditable. Customers under active engagement will be notified by email when material changes ship.

> **TODO (Garabyte):** Decide what counts as "material" — typically: new subprocessor, new data category, change to retention, change to deletion process.

---

## Self-audit

Eventually, this product should be scored against its own rules library. Best done after auth (C1) and the DSAR workflow (H4) land. Run through d1–d8 and see what comes back; that's the most honest gut-check on whether the product is ready to be sold.
