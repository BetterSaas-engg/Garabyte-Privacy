# Audit follow-ups

After the Phase 1–10 work, an independent code-reviewer pass turned up
sixteen findings. Six were fixed inline (commit `120b8da` — see
`docs/dsar-runbook.md`-adjacent commit message). The rest are tracked
here so they're not forgotten.

Severity tier follows the same scheme as the original audit: 🔴 ship-
blocker, 🟠 fix before customer GA, 🟡 next sprint.

## Fixed inline (no ticket needed)

- 🔴 Cascade FKs missing on `assessments.tenant_id` and `responses.assessment_id` — added via Alembic migration `c72d7cb319fa`.
- 🔴 M22 jurisdiction filtering not wired despite the helper existing — `filter_regulatory_text()` now scans free-form `regulatory_risk` and suppresses out-of-scope citations on the share-link payload.
- 🔴 Invitation `dimension_ids` not validated against the rules library — `auth/routes.py:create_invitation` now rejects unknown ids with 400.
- 🟠 Evidence MIME header was the only check; HTML-as-PDF could enable stored XSS — magic-byte verification rejects mismatches at 415; download disposition is `attachment` + `nosniff` so anything that slipped through doesn't render in-place.
- 🟠 No CSRF defense on cookie-auth mutations — every mutating request must now carry `X-Requested-With: garabyte`; the header is non-simple under CORS, forcing a preflight that's gated by the allow_origins list.

## Still hanging

### 🟠 High

**A1. Tenant DELETE logging is in the same transaction as the cascade.**
`routes/tenants.py:delete_tenant` calls `log_access(...)` then `db.delete(tenant)` then `db.commit()`. If the cascade traversal raises (e.g. some future model has a stale FK), the audit row never lands because everything rolls back together. Fix: split into two transactions — log first, commit, then delete.

**A2. `_revoke_share_links_for` ignores already-expired links.**
`routes/assessments.py:_revoke_share_links_for` filters on `expires_at > now`. Expired-but-not-revoked rows stay around with no `revoked_at`, so the audit trail can't distinguish "expired naturally" from "revoked on republish." Set `revoked_at = now` on those rows too, or split the audit-action.

**A3. Invitation accept path doesn't check identity match.**
`auth/routes.py:accept_invitation` calls `consume_token` and then mints a new session. If a logged-in user A clicks an invitation link addressed to user B, the flow attaches a fresh B-session AND adds a membership in B's name. If A and B are different humans, you've conflated identities. Fix: when `get_current_user_optional` returns a user with a different email than `row.email`, reject with 409 and prompt for sign-out.

**A4. Audit-log gap on share-link reads of deleted assessments.**
`routes/share_links.py:read_shared_report` raises 404 at `:288` (assessment was DSAR-deleted under a still-active link) without a log row. Add `log_access(... "share_link.read.tombstone")` so DSAR-aftermath access attempts are evidenced — they're the most likely surface where a regulator asks "who tried to view this after we said it was gone?"

### 🟡 Medium

**A5. `tenant_history` filters in Python.** `routes/tenants.py:get_tenant_history` lazy-loads every assessment then filters to `status == "completed"` in a list comp. Switch to a `.filter(Assessment.status == "completed").order_by(...)` query.

**A6. `evidence_storage.put` reads the entire upload into memory before sizing.** `routes/evidence.py:upload_evidence` does `raw = await file.read()` and only then checks `len(raw) > evidence_max_bytes`. A 500 MB upload OOMs the worker before the 413 fires. Stream-read in chunks with a running size counter.

**A7. `Response.answered_by_id` is `SET NULL` on user delete; user delete itself is not gated.** No `DELETE /users/{id}` exists today, so this is latent. When user-DSAR lands, deleting a User will null out `answered_by_id` across every historical response in every tenant they ever worked in, silently destroying the regulatory-defensibility chain M23 was supposed to provide. Add a soft-delete (`User.deleted_at`) instead of hard delete; preserve the FK.

**A8. `evidence_url` accepts plain HTTP in production.** `schemas/assessment.py` regex is `r"^https?://"`. Tighten to `^https://` in production via config.

**A9. No bootstrap path for the first `garabyte_admin` membership.** `seed.py` creates demo tenants but no users; `bootstrap.py` exists but isn't invoked anywhere. First production deploy → no admin → no way to create a tenant via the API → only path is direct SQL. Document the bootstrap CLI invocation in `README.md` and `docs/dsar-runbook.md`.

**A10. `init_db` runs `alembic upgrade head` on every startup.** `database.py:init_db`. The docstring acknowledges the multi-replica race; Railway can scale to 2 instances under load. Add an advisory lock or move migrations to a release-phase command.

**A11. `consultant.engagements.list` ignores assessments where the user is also an org admin of their own consultancy.** `routes/assessments.py` filters memberships to `m.role == ROLE_CONSULTANT`, which is correct for the cross-tenant case but drops the consultant's own org. Cosmetic for now but document the contract.

## Recommended fix order

A1 + A4 (audit-log gaps) are 5-minute fixes and worth picking off next.
A3 (invitation identity check) is the highest-impact remaining item —
it's a quiet identity-confusion bug in a flow customers actually use.
A6 is the largest scope; do it before raising the file-size cap above
10 MB.
