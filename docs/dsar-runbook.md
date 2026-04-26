# DSAR fulfillment runbook

This document describes how Garabyte fulfills Data Subject Access Requests
against the Privacy Health Check platform. It is the operational counterpart
to the technical DELETE endpoints — components (1) and (8) of the audit's
H4 finding live in code; everything else lives here.

## Scope

This runbook covers data the platform itself stores. It does **not** cover:

- Garabyte's email and chat archives (Google Workspace governance)
- Salesforce / HubSpot / equivalent CRM records about the customer
- Internal documents drafted from the assessment (Notion, Google Drive)
- Backup snapshots (see §6)

A complete DSAR response requires touching all of these surfaces. The
Garabyte ops lead is responsible for coordinating across them; the platform
DELETE is one of multiple actions, not the entire response.

## Applicable jurisdictions and timeline

The strictest applicable timeline is **30 calendar days** from receipt of
a verified request. This satisfies:

- PIPEDA — 30 days
- Quebec Law 25 — 30 days
- GDPR Art. 12 — one month (extensible to three for complex cases)

If multiple jurisdictions apply to the same customer, treat 30 days as the
hard cap. Document any extension reasoning in the audit artifact (§7).

## Intake

DSAR requests arrive via:

1. The `privacy@garabyte.com` mailbox (canonical channel).
2. A request from inside an active engagement, escalated by the assigned
   consultant.
3. A regulator-mediated complaint (rare; treat as priority).

The Garabyte ops lead is the single point of contact for intake. They:

1. Acknowledge receipt within 2 business days.
2. Confirm the requester's identity (proof of authority to act on the
   organization's behalf — usually a signed letter or a domain-matched email
   from a named privacy officer).
3. Confirm the scope: full deletion vs. partial (one assessment, one user,
   one consultant's annotations) vs. access (read-only export).
4. Record the request in the Garabyte ops register with a ticket ID; this
   ID appears in every audit log entry produced during fulfillment.

## Authority and scoping

- **Full tenant deletion** is authorized by the org's `org_admin` (or
  higher) and executed by a Garabyte admin. Customer org_admins cannot
  self-serve a deletion — the request flows through Garabyte ops so an
  audit artifact can be produced.
- **Single assessment deletion** can be authorized by either an org_admin
  of that tenant or a Garabyte admin. Useful when a customer wants to
  drop a preliminary draft without losing other engagement history.
- **User deletion** (DELETE /auth/users/{id}, not yet implemented; see
  Phase 9 audit follow-up) deletes a User row but preserves audit trail
  via FK ondelete=SET NULL.

## Execution

For full tenant deletion, the Garabyte admin runs:

```bash
curl -X DELETE \
  -H "Cookie: gp_session=…" \
  https://api.garabyte-privacy.example/tenants/<slug>
```

The endpoint:

1. Snapshots tenant identifying data (slug, name, assessment count) into
   `access_log.context`.
2. Logs `tenant.delete` to the audit log.
3. Cascades the deletion across `assessments`, `responses`, `findings`,
   `finding_annotations`, `assessment_publications`, and `org_memberships`.
4. Returns 204 No Content on success.

`access_log` rows reference `org_id` with `ondelete=SET NULL`; the audit
trail itself survives the deletion. This is the regulatory defense if a
regulator later asks "what happened to org X" — the answer is in the log.

## Backup retention

Production database backups are retained for **30 days** by Railway's
managed Postgres. After a DSAR deletion the data may persist in backups
for up to that window. Per PIPEDA and GDPR guidance, a documented short
retention period for backups is acceptable provided:

1. The data cannot be selectively restored (we don't restore individual
   tenants from backup, only full database).
2. A re-deletion policy is in place (§6).

We do **not** scrub individual records from backup snapshots — Railway
does not support that operation. We rely on the rolling 30-day expiry.

## Re-deletion policy

If a database restore is performed within 30 days of a DSAR deletion
(e.g. recovering from data loss), the on-call engineer must:

1. Cross-reference the access log against the restored tenant table.
2. Re-issue any `tenant.delete` actions whose targeted row reappears.
3. Update the original DSAR ticket noting the re-deletion and reason.

This re-deletion is itself logged. The customer is notified within 7 days.

## Audit artifact

For every fulfilled DSAR Garabyte produces a signed PDF artifact containing:

- DSAR ticket ID
- Date received, identity verified, fulfilled
- Scope of deletion (tenant slug, assessment IDs, etc.)
- The relevant `access_log` row IDs
- A statement of the platform actions taken
- Subprocessor list (Vercel, Railway) and confirmation that no further
  action is needed at those layers (or, if action was needed, what)
- Signature of the Garabyte ops lead

The artifact is stored in the Garabyte ops vault, not in the platform
database (so it survives a full platform deletion).

## Subprocessor coordination

- **Vercel** hosts the frontend; it does not store customer data.
- **Railway** hosts the backend and managed Postgres. Customer data is
  governed by Railway's Data Processing Addendum. We do not need to file
  a DSAR with Railway — the deletion at the application layer is the
  operative step.
- **Email service (post-Phase 7)** retains transactional email logs.
  When that integration lands, the runbook will be updated to include a
  scrub step against that provider.

## Open follow-ups

- Implement a customer-facing DSAR submission endpoint discoverable from
  the dashboard (currently the customer must email us).
- Add a `Tenant.deletion_requested_at` timestamp + acknowledgment workflow
  so we can show "deletion in progress" in the UI.
- Build a per-user data export endpoint (access requests, not deletion).
