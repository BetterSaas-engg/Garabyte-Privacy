# Audit follow-ups

After the Phase 1–10 work, an independent code-reviewer pass turned up
sixteen findings. Six were fixed in commit `120b8da`; A1–A4 in a
follow-up; A5/A8/A11 + consultant-flow notifications in another;
A6/A10 + A7 (user soft-delete) in subsequent rounds. All sixteen
findings are now closed. This file is kept as the historical paper
trail.

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

### 🟡 Medium — all closed

**A5.** `tenant_history` switched to a SQL `.filter(...)` instead of lazy-load + Python list-comp. `routes/tenants.py`.

**A6.** `evidence_storage.put` now reads in 64 KB chunks into a `SpooledTemporaryFile` (2 MB in-memory threshold), with a running size counter that aborts with 413 the moment the cap is exceeded. `routes/evidence.py:upload_evidence`. Empty uploads now return 400.

**A7.** `User.deleted_at` added (Alembic `c30fc25dcb6f`). `read_session`, login, magic-request, password-reset-request all reject soft-deleted users. New `DELETE /auth/users/{id}` (garabyte_admin only) sets `deleted_at`, revokes all sessions, refuses to delete the last live garabyte_admin. Re-accepting an invitation reactivates a soft-deleted user (clears `deleted_at` + logs `auth.user.reactivated`). Audit-log display projections still resolve soft-deleted users' email so the regulatory chain stays readable.

**A8.** `evidence_url` regex stays permissive (`^https?://`); a `field_validator` rejects plain http when `settings.app_env != "development"`. `schemas/assessment.py`.

**A9.** Production bootstrap procedure documented in README's "First-time production deploy" section.

**A10.** `init_db` wraps `alembic upgrade head` in a `pg_advisory_lock` on Postgres so concurrent replica boots serialize. `database.py:init_db`. SQLite path unchanged.

**A11.** `consultant.engagements.list` docstring spells out the visibility contract — garabyte_admin sees all, consultant role sees that tenant only, other roles fall through to `/tenants`. `routes/assessments.py`.

## All sixteen findings closed

The audit pass that produced this list is fully addressed. New findings
should go into a fresh document; this one is closed history.
