# Audit follow-ups

After the Phase 1–10 work, an independent code-reviewer pass turned up
sixteen findings. Six were fixed in commit `120b8da`; A1–A4 (the four
🟠 items below) were fixed in a follow-up commit. The remaining six 🟡
items are tracked here so they're not forgotten.

Severity tier follows the same scheme as the original audit: 🔴 ship-
blocker, 🟠 fix before customer GA, 🟡 next sprint.

## Fixed inline (no ticket needed)

- 🔴 Cascade FKs missing on `assessments.tenant_id` and `responses.assessment_id` — added via Alembic migration `c72d7cb319fa`.
- 🔴 M22 jurisdiction filtering not wired despite the helper existing — `filter_regulatory_text()` now scans free-form `regulatory_risk` and suppresses out-of-scope citations on the share-link payload.
- 🔴 Invitation `dimension_ids` not validated against the rules library — `auth/routes.py:create_invitation` now rejects unknown ids with 400.
- 🟠 Evidence MIME header was the only check; HTML-as-PDF could enable stored XSS — magic-byte verification rejects mismatches at 415; download disposition is `attachment` + `nosniff` so anything that slipped through doesn't render in-place.
- 🟠 No CSRF defense on cookie-auth mutations — every mutating request must now carry `X-Requested-With: garabyte`; the header is non-simple under CORS, forcing a preflight that's gated by the allow_origins list.
- 🟠 **A1.** Tenant + assessment DELETE flows now log `*.intent` in their own transaction before the cascade, then `*.complete` (or `*.failed` with the exception) after. The cascade can no longer roll back the audit trail. `tenant.delete.complete` lands with `org_id=None` because the tenant FK is gone by then.
- 🟠 **A2.** `_revoke_share_links_for` now stamps `revoked_at` on every non-revoked row, including ones that have expired naturally. Audit trail can distinguish expired-vs-revoked via the action name, not via the absence of `revoked_at`.
- 🟠 **A3.** `auth/routes.py:accept_invitation` now resolves `get_current_user_optional` and rejects with 409 + `auth.invitation.identity_mismatch` audit row when the signed-in email differs from the invitation's email. The `consume_token` call is rolled back so the recipient can sign out and re-accept with the same link.
- 🟠 **A4.** Tenant + assessment DELETE flows now enumerate every `share_link` they're about to cascade-destroy and log `share_link.cascade_delete` rows for each (with label, was_revoked, cascade_reason). Post-DSAR invalid-token reads can be correlated by `resource_id`. A defensive `share_link.read.tombstone` row is also logged in the unreachable-with-FK-on case where a link survives its assessment.

## Still hanging

### 🟡 Medium

**A5. `tenant_history` filters in Python.** `routes/tenants.py:get_tenant_history` lazy-loads every assessment then filters to `status == "completed"` in a list comp. Switch to a `.filter(Assessment.status == "completed").order_by(...)` query.

**A6. `evidence_storage.put` reads the entire upload into memory before sizing.** `routes/evidence.py:upload_evidence` does `raw = await file.read()` and only then checks `len(raw) > evidence_max_bytes`. A 500 MB upload OOMs the worker before the 413 fires. Stream-read in chunks with a running size counter.

**A7. `Response.answered_by_id` is `SET NULL` on user delete; user delete itself is not gated.** No `DELETE /users/{id}` exists today, so this is latent. When user-DSAR lands, deleting a User will null out `answered_by_id` across every historical response in every tenant they ever worked in, silently destroying the regulatory-defensibility chain M23 was supposed to provide. Add a soft-delete (`User.deleted_at`) instead of hard delete; preserve the FK.

**A8. `evidence_url` accepts plain HTTP in production.** `schemas/assessment.py` regex is `r"^https?://"`. Tighten to `^https://` in production via config.

**A9. No bootstrap path for the first `garabyte_admin` membership.** `seed.py` creates demo tenants but no users; `bootstrap.py` exists but isn't invoked anywhere. First production deploy → no admin → no way to create a tenant via the API → only path is direct SQL. Document the bootstrap CLI invocation in `README.md` and `docs/dsar-runbook.md`.

**A10. `init_db` runs `alembic upgrade head` on every startup.** `database.py:init_db`. The docstring acknowledges the multi-replica race; Railway can scale to 2 instances under load. Add an advisory lock or move migrations to a release-phase command.

**A11. `consultant.engagements.list` ignores assessments where the user is also an org admin of their own consultancy.** `routes/assessments.py` filters memberships to `m.role == ROLE_CONSULTANT`, which is correct for the cross-tenant case but drops the consultant's own org. Cosmetic for now but document the contract.

## Recommended fix order

🟠 items (A1–A4) are now landed. Of the remaining 🟡 set, A6 is the
largest scope (rewrite evidence upload to stream-read with a running
size counter) — do it before raising the 10 MB file-size cap. A10
(multi-replica migration race) is the only one that blocks production
scaling; address before the second Railway instance.
