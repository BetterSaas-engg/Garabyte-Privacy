# Garabyte Privacy Health Check — Roles and Permissions

A reference specification for who can do what across the product. Subsequent
implementation prompts reference the conditional rules (C-numbers) defined
in section 3.

This document is a spec, not a UI mockup, and not a deployable policy
file. It describes intent. The IAM layer that enforces it is out of
scope here.

---

## 1. Role catalog

### Customer-side

**Org admin.** The customer-side owner of an assessment. Typically the
privacy lead, chief privacy officer, or general counsel — whoever the
organization has designated as accountable for the privacy program.
Usually one person, occasionally two for redundancy. They start the
assessment, invite colleagues to fill sections they don't own, watch the
overall progress dashboard, decide when the assessment is ready to
submit, and receive the final scored report. The defining constraint:
they own the assessment as an artifact and are accountable for the
decision to submit it. Org admins can do everything a section
contributor can do, in any section.

**Section contributor.** A subject-matter expert from the customer
organization who answers questions in one or more dimensions assigned to
them. The IT director answering d2 (data inventory) is a section
contributor; the procurement lead answering d5 (vendor management) is a
section contributor. They attach evidence to their answers and leave
comments within their sections. The defining constraint: they can read
and write only the dimensions assigned to them. They do not see other
dimensions of the assessment, do not see the overall score, and do not
see the report until the org admin shares it.

**Org viewer.** A read-only consumer of the published report. Board
members, audit committee members, internal auditors, and external
counsel who need to see results without changing anything. The defining
constraint: read-only on the report and only after publication. They do
not see drafts, evidence files, or the question-level history.

### Garabyte-side

**Consultant.** A Garabyte employee assigned to specific customer
accounts. They review findings before they go to the customer, edit the
prose where the rules engine's output needs sharpening, and publish the
final report back to the customer organization. The defining constraint:
they can only see the customer accounts they are explicitly assigned to.
A consultant who is not assigned to Acme Corp cannot read Acme Corp's
data — this is essential for the credibility of the consulting layer.

**Rules editor.** A Garabyte employee who maintains the YAML rules
library: questions, remediation entries, regulatory mappings, scoring
formulas. Typically a senior privacy expert, often someone who is also a
consultant on a small number of accounts. The defining constraint: they
can edit the rules library, which affects every assessment going
forward, but they have no access to customer-specific data unless they
are also assigned as a consultant to that account.

**Garabyte admin.** A Garabyte employee who manages the platform's
internal operations: consultant-to-customer assignments, customer
account creation and deletion, billing, organization-level settings,
and the user invitations that bootstrap a new customer org admin. The
defining constraint: they have administrative reach across customers
but do not, by default, read into a specific customer's assessment data
— that requires explicit consultant assignment, logged.

### System

**Unauthenticated visitor.** Anyone on the open internet who lands on
garabyte's marketing surfaces or follows a signed share link. They see
only what is intentionally public. The defining constraint: no
identity, no session, no per-tenant data.

---

## 2. Permission matrix

Cell values: `none`, `read`, `read-write`, `conditional` (numbered
condition described in section 3).

| Resource | Visitor | Org admin | Section contributor | Org viewer | Consultant | Rules editor | Garabyte admin |
|---|---|---|---|---|---|---|---|
| Landing page | read | read | read | read | read | read | read |
| Sample report | read | read | read | read | read | read | read |
| Login / signup | read-write | read-write | read-write | read-write | read-write | read-write | read-write |
| Invitation acceptance | C1 | C1 | C1 | C1 | C1 | C1 | C1 |
| Customer dashboard | none | read-write | C2 | none | C3 | none | C4 |
| Questionnaire screens (per dimension) | none | read-write | C5 | none | C6 | none | C4 |
| Evidence files attached to answers | none | read-write | C7 | none | C8 | none | C4 |
| Submission completion review | none | read-write | none | none | C9 | none | C4 |
| Scored report (in-app) | C10 | C11 | none | C12 | C13 | none | C4 |
| Findings (prose edits) | none | none | none | none | C14 | none | none |
| Consultant console | none | none | none | none | C15 | none | C16 |
| Rules library editor | none | none | none | none | none | read-write | read |
| Garabyte admin surfaces | none | none | none | none | none | none | read-write |
| User invitations within org | none | C17 | none | none | C18 | none | C19 |
| Billing surface | none | C20 | none | none | none | none | read-write |
| Customer account creation | none | none | none | none | none | none | read-write |
| Consultant assignment | none | none | none | none | none | none | read-write |

---

## 3. Conditional rules

The numbered conditions referenced in the matrix above. Subsequent
implementation prompts cite these by number.

**C1. Invitation acceptance is identity-bound.** An invitation link is
signed for a specific email address and a specific role within a
specific organization. Anyone may follow the link, but to accept they
must authenticate as the invited email. Following the link before
accepting reveals only the inviting org's name and the role being
offered, never assessment data.

**C2. Section contributor sees the dashboard, scoped.** They see the
dashboard's overall layout, including the org name and overall progress
percentage, but the dimensions list shows their assigned dimensions in
full detail and other dimensions as a single muted line ("Owned by
[name]") with no scores, no question counts, no evidence. They do not
see the submission CTA.

**C3. Consultant reads the dashboard for assigned customers.** A
consultant assigned to Acme Corp can read Acme's dashboard exactly as
the org admin sees it, but cannot edit any answer or assignment. They
see one read-only banner across the top: "Consultant view — Acme Corp."

**C4. Garabyte admin requires explicit elevation.** A Garabyte admin who
is not assigned as a consultant to a customer cannot read that
customer's assessment data through the normal product surfaces. Reading
customer data requires a logged "support access" elevation — a separate
mechanism out of scope for this spec but referenced here so that
implementations do not silently grant read access.

**C5. Section contributor: read-write only on assigned dimensions.**
Read-write within the dimensions explicitly assigned to them by an org
admin. No read access to questions in unassigned dimensions; navigation
between dimensions is restricted to the assignment list.

**C6. Consultant: read but not write on questionnaire screens.**
Consultants do not answer questions on the customer's behalf — that
would corrupt the integrity of the assessment. They can read every
answer with full context (text, evidence, comments) for accounts they
are assigned to.

**C7. Section contributor: evidence files within assigned dimensions
only.** Read-write on evidence within their dimensions. They cannot see
evidence attached to other dimensions, even read-only.

**C8. Consultant: read on evidence files, with watermark.** Read-only
on all evidence in assigned customer accounts. Downloads carry a
watermark identifying the consultant and the access time. This is for
defensibility, not access control — the consultant could still
screenshot, but downloads are at least logged.

**C9. Consultant: read on submission review, write on consultant
notes.** Consultants can see the submission completion review screen
read-only and can attach internal notes that the customer does not see.
They cannot trigger submission on the customer's behalf.

**C10. Visitor: sample report only.** The public sample report
(`Sample Report.html` in the implementation) is the only scored-report
surface a visitor sees. It is fictional Northwind Logistics data,
clearly labeled. See also C12 for the signed-link case.

**C11. Org admin: full read-write on the customer's own report.**
Including marking findings as accepted, dismissed, or in-progress;
choosing what to share via signed link; configuring report viewer
access.

**C12. Org viewer: read-only on the published report.** Including
reading findings, scores, the regulatory matrix, and dimension
breakdowns. They cannot read the question-level answers underneath
findings, cannot read evidence files, and cannot see the submission
review. They cannot share the report further; if a board member needs
to share with another board member, the org admin issues a new viewer
invitation. See also C21 for the signed-link variant of viewer access.

**C13. Consultant: read-write on findings, read on the rest of the
report.** A consultant can edit finding prose, sequencing, and
recommended hours before the report is published — this is the core of
their value-add. Once published, the report becomes read-only for the
consultant.

**C14. Findings: edit window closes on customer publication.**
Consultants may edit finding prose, hours, and severity ranking only
between the customer's submission and the consultant's publish action.
After publish, the report is immutable; corrections require a new
report version, which the org admin must explicitly accept.

**C15. Consultant console: only assigned customers.** The console lists
only the customers a consultant is currently assigned to. Reassignment
removes the customer from the console immediately. Historical access
(see C22) is logged but not browsable through the console.

**C16. Garabyte admin: console as observer.** Read-only on the
consultant console. Useful for triaging support requests; they can see
which customer is assigned to which consultant without seeing the
customer's data.

**C17. Org admin: invitations within their own organization.** Can
invite section contributors and org viewers. Cannot invite another org
admin without a separate explicit handoff (see role transition,
section 4d).

**C18. Consultant: cannot invite customer-side users.** A consultant
cannot expand the customer's own user list. Customer-side membership is
controlled by the customer org admin, not the consultant. (Garabyte
admins can intervene per C19, with the customer's consent recorded.)

**C19. Garabyte admin: bootstrap invitations only.** A Garabyte admin
can issue the first org admin invitation when a new customer account is
created. After that, customer-side membership is controlled by the
customer org admin per C17. Garabyte admin can intervene if the org
admin role is vacated entirely (see role transition, section 4d).

**C20. Org admin: billing read; payment write requires confirmation.**
The org admin sees billing surface but changes to payment method
require a separate confirmation step (re-authentication or recovery
code). Out of scope to detail here.

**C21. Read-only signed links bypass account creation.** A privacy lead
can issue a signed URL that grants read-only viewer access to the
published report without requiring the recipient to create an account.
The link is bound to a specific report version, has an expiry (default
30 days), is rate-limited, and access is logged. This is how a board
member who refuses to create yet another account can still see the
report. The link can be revoked any time; a new link can be issued for
a new audience.

**C22. Historical access is logged, not browsable.** Once a consultant
is unassigned, they cannot reach the customer's data through the
console. Audit-log access by the customer is out of scope here — see
section 6.

---

## 4. Role transitions

### a. Org admin invites a section contributor

**Before invitation.** The contributor either has no Garabyte account
or has accounts in unrelated organizations. They have no awareness of
the customer's assessment.

**Invitation sent.** The contributor receives an email with a signed
link bound to their email address and the role offered. Following the
link before accepting reveals only the inviting org's name, the role,
and the dimensions assigned. Following without authenticating prompts
sign-in or sign-up; signing in with a different email rejects the
invitation (per C1).

**Acceptance.** The contributor's account is added to the
organization with the section-contributor role and the specific
dimension assignments. On their next dashboard load, they see the
scoped dashboard described in C2 — the dimensions they own in full,
others muted.

**Withdrawal.** The org admin can withdraw assignments at any time. A
withdrawn contributor loses access to the dimension immediately; their
prior answers remain on the assessment, attributed to them but no
longer editable by them.

### b. Section contributor needs to escalate a question they can't answer

The contributor leaves a comment on the question marking it as
"escalate." This triggers a notification to the org admin. The org
admin can either reassign the dimension to another contributor (the
question's prior answer becomes read-only history for the original
contributor and read-write for the new one) or answer the question
themselves (the org admin always has read-write per C5's exception).

The contributor does not gain new permissions through escalation —
they cannot see other dimensions, and they cannot pull in another
contributor on their own. Both of those are org-admin actions.

### c. Consultant assignment changes mid-engagement

A Garabyte admin reassigns a customer from consultant A to consultant
B. Effective immediately:

- Consultant A's console drops the customer; their session, if
  currently viewing the customer, is interrupted at the next request
  with a "no longer assigned" message.
- Consultant B's console gains the customer with full read access
  (C3, C6, C8, C13). Any draft finding edits consultant A had in
  flight are visible to B as a read-only "previous consultant" diff,
  not silently merged.
- The customer org admin receives a notification ("Your consultant has
  changed from A to B") so the change is not invisible to them.
- All access by both consultants is logged for audit purposes.

### d. Org admin leaves the organization

If there is a second org admin, no transfer is needed — the second one
continues. If there is only one, the leaving admin can transfer the
role to any existing org member (typically a section contributor),
which elevates that user to org admin in the same flow as a
self-promotion.

If the only org admin departs without transferring, the customer is
left without any org admin. The Garabyte admin can intervene (per C19)
by issuing a new bootstrap invitation to a designated successor, but
this requires a verification step with the customer organization out
of scope here. While the customer has no org admin, the assessment
remains read-only — section contributors can still read their assigned
dimensions but cannot submit, invite, or publish.

### e. Customer publishes the report and adds an org viewer afterward

The org admin publishes. The report becomes read-only as defined in
C14. Any future contributor edits within the assessment do not affect
the published report; they only affect a new draft.

The org admin then invites a board member as an org viewer. The board
member receives a signed invitation per C1. On acceptance they see the
published report read-only per C12. They do not see any drafts, prior
versions, or working evidence — just the published artifact.

If the board member refuses to create an account, the org admin can
instead issue a signed share link per C21. Both mechanisms grant the
same read-only view; the difference is only in identity.

---

## 5. Edge cases

### a. The same person is org admin at one customer and section contributor at another

Supported. Identity is the user account; roles are per-organization.
The dashboard surface includes an organization switcher (out of scope
to specify here, but the model assumes it). Within Acme, the user is
org admin and sees the full dashboard. Within Northwind, the same user
is section contributor and sees only the assigned dimensions. There is
no cross-organization data leak: the IAM layer scopes every request by
organization, not just by user.

### b. Customer-side user who is also a Garabyte consultant on a different account

Supported with care. The user has two distinct contexts: customer-side
on their employer's assessment (where they may be org admin or section
contributor), and Garabyte-side on customer accounts they are assigned
to as a consultant. The contexts do not bleed: when acting as a
consultant on Acme, they cannot see their own employer's data through
the consultant console, and vice versa.

The audit log records context. If the same user reads Acme as a
consultant at 3:14 pm and reads their own employer's data at 3:15 pm,
those are two distinct entries with clearly different role contexts.

### c. Org admin wants to act as a section contributor to test the experience

The org admin's permissions strictly include the section contributor's,
so they can already see what the contributor sees by navigating to the
relevant dimension. What they cannot natively do is see the *scoped*
dashboard (C2) — by default they see the full one.

A "preview as contributor" mode is a useful product feature but is not
a permission-model concern. Implement it as a UI toggle that filters
the org admin's view to mimic a contributor's, without changing actual
permissions. The toggle does not log as a different identity; the org
admin remains the org admin in the audit log throughout.

### d. Read-only viewer link for a board member without an account

Yes, supported per C21. The privacy lead generates a signed URL bound
to the published report version. The link's holder reads the report
without authenticating, subject to:

- expiry (default 30 days from issuance, configurable down to 24
  hours)
- revocation by the privacy lead at any time
- rate limiting per link (to detect a leaked link being scraped)
- access logging by IP and user agent (so the privacy lead can see
  someone has accessed it)

The signed link is the right answer for one-shot board distribution.
For ongoing access by a board member who reviews quarterly reports,
issuing them an org viewer invitation is preferable: it ties the
access to a person, not a URL.

The signed link does **not** grant access to evidence files, drafts, or
the question-level answer history — same restrictions as an org
viewer. It grants exactly the published report, nothing more.

---

## 6. Out of scope

Deferred to product or legal:

- **Data retention by role.** When a section contributor's session
  expires, when their answer history is purged after they leave the
  organization, retention of evidence files after report publication.
  Retention is a privacy-policy and product-policy question; this
  spec does not pin it down.
- **Geographic restrictions.** Where the data is stored, which roles
  can read which residency-tagged data, EU/Canadian residency
  separation. The product will need to address this for its own
  privacy posture; the role model here does not encode geography.
- **Audit log visibility per role.** Who can read the audit log,
  whether org admins see consultant access events, whether
  contributors see who else worked on the dimension. These are real
  questions but they are downstream of this spec.
- **Specific regulator-response workflows.** What happens if a
  regulator subpoenas a customer's data; the discovery flow that
  would produce; the role allowed to authorize disclosure. Legal,
  not product.

---

## Appendix: design notes

A few decisions worth recording so subsequent prompts do not relitigate
them.

- **Three customer-side roles, not five.** Org admin / section
  contributor / org viewer is enough to express the assessment
  workflow. Adding more (e.g., separating "evidence reviewer" from
  "answer author") would create confusion without solving a real
  product problem. If a customer's process needs more granularity,
  workflow notes and comments cover it.

- **Consultant cannot answer questions on the customer's behalf.**
  This is a deliberate constraint, not an oversight. The credibility
  of a Garabyte report rests on the customer's answers being the
  customer's own; a consultant filling in a section would corrupt
  that. Consultants edit findings (C13/C14) because findings are
  prose synthesis, not raw answers.

- **Garabyte admin defaults to no customer data access.** They can do
  their job — assignments, billing, account creation — without
  reading into a customer's assessment. When they need to read into a
  customer (a support escalation), the access is logged as a separate
  elevation event (C4). This protects Garabyte's own privacy posture
  and gives customers a defensible answer to "who at Garabyte can
  read our data."

- **Rules editor is intentionally narrow.** They edit the rules
  library, which affects every assessment going forward, so they need
  no per-customer access to do their job. Splitting rules editing
  from consultant work also means a rules editor who is *not* a
  consultant on a given account cannot read that account's data —
  important because the rules editor is a high-trust role with broad
  effect.
