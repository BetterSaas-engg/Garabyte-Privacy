# Rules-library lifecycle — design proposal

## Problem

The 8 dimension YAMLs and `compound_rules.yaml` ship inside the Docker
image. A typo fix in a recommendation, a new compound rule, an AIDA
citation update, or any sector-calibration tweak all require:

1. A code edit in `rules/`
2. A pull request
3. A merge to main
4. A Railway deploy

That's the wrong cadence for content. It also forces every rules-edit
through engineering even when the actual change is a privacy-practice
decision (e.g. rephrasing a recommendation after a regulator clarified
guidance).

The audit's M24 named this:

> Rules library evolution undesigned. The rules library will change over
> time — questions reworded, weights tweaked, regulations updated, new
> questions added, old ones retired. The current code reads YAMLs from a
> filesystem path at startup; result records (after M18 fixes) will
> store a `rules_version` hash. Neither solves the comparison problem
> when a customer reassesses 6 months later under a different rules
> version.

This doc enumerates options, recommends one, and lists the decisions
needed.

## What we already have

- `rules/*.yaml` — 9 files (8 dimensions + compound rules)
- `RulesLibrary.version` — sha256 hash of all YAML bytes, computed at
  load time
- `Assessment.result_json.rules_version` — frozen on every scored
  assessment for trend-discontinuity detection (already wired into the
  trend chart's UI)
- `Finding.finding_template_id` — stable hash of (dimension, severity,
  finding text). Lets a finding fired in Q4 match itself fired in Q1
  even if the wording shifts slightly.

The data layer already supports versioned rules. What's missing is the
authoring + deployment loop.

## Three options

### Option A — Stay in the Docker image (status quo)

Don't change anything. Document the current cadence and accept it.

**Pros**
- Zero engineering work
- Single source of truth (the YAML files in git)
- Every rules change goes through PR review — defensible audit trail

**Cons**
- Content authors need engineering for every edit
- A typo fix takes 30+ minutes (PR → review → merge → deploy)
- Doesn't scale beyond the current 9-file library

**When this is the right answer:** if Garabyte expects ≤10 rules edits
per year and the privacy practice is comfortable with engineering
gating each one. Defer the change until the cadence becomes painful.

### Option B — Object storage with versioned objects

Move the YAMLs out of the Docker image and into S3 / Railway Volume /
similar. Application loads them at startup from the storage bucket.
Each upload creates a new versioned object; the application can pin to
a specific version (or always read the latest tagged "production"
version).

```
s3://garabyte-rules/
  ├── prod/                    # what the API loads
  │   ├── d1_governance.yaml
  │   ├── ...
  │   └── compound_rules.yaml
  ├── staging/                 # for previewing changes
  │   └── ...
  └── archive/2026-04-15/      # snapshot of every promotion
      └── ...
```

Authoring loop:
1. Author edits a YAML locally (or in a CMS like Decap/TinaCMS)
2. Uploads to `staging/`
3. Garabyte staging environment auto-loads it; runs a smoke assessment
   against the new rules
4. If it looks right, promote staging → prod (a button click in the
   admin console, or a CLI command)
5. Production API reloads (or restarts) and picks up the new version

**Pros**
- No deploy needed for content edits
- Staging-to-prod promotion gives a real preview before customers see
  the new rules
- Per-tenant pinning becomes possible (a customer mid-engagement keeps
  seeing rules v3 even after v4 is current)
- Garabyte ops can approve content changes without engineering
- Audit trail is preserved via S3 versioning + the existing
  `rules_version` hash

**Cons**
- Nontrivial engineering: rules loader needs to fetch from object
  storage at startup, handle network failures gracefully, support hot
  reload on prod-version bump
- Operational overhead: someone has to manage the bucket, the
  promotion flow, the staging environment
- Loses the "every change is in git" defensibility unless we ALSO mirror
  to git (now you have two sources of truth)
- Per-tenant pinning is a meaningful schema change — `Tenant` gains a
  `rules_version_pinned` column; loader has to support multiple
  versions concurrently

### Option C — Database table + admin CMS

Move the YAMLs into the database. New tables: `RulesVersion`,
`RulesDimension`, `RulesQuestion`, `RulesRemediation`, `RulesCompoundRule`,
all keyed by `rules_version`. Build a small admin CMS at
`/consultant/admin/rules` for editing.

```sql
CREATE TABLE rules_versions (
    id           SERIAL PRIMARY KEY,
    label        TEXT,                    -- "v2026.04 — AIDA rewrite"
    is_active    BOOLEAN NOT NULL,
    parent_id    INTEGER REFERENCES rules_versions(id),
    created_at   TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ
);
-- ... + child tables
```

Authoring loop:
1. Garabyte admin clones the active rules version → new draft version
2. Edits in the admin CMS (table-style UI for questions, rich-text for
   recommendations)
3. Previews scoring of a sample assessment under the draft
4. Activates the draft → marks `is_active=true`, deactivates the prior
5. New assessments score under the new version; older scored
   assessments stay pinned to their original version (already supported
   via `result_json.rules_version`, just needs the lookup to resolve)

**Pros**
- Tightest authoring loop — no file upload, just edit + activate
- Built-in version history (every prior version is queryable)
- Per-tenant pinning is trivial (`Tenant.pinned_rules_version_id`)
- Branching — can have multiple drafts in flight at once
- Best fit if Garabyte ever wants tiers of rules (e.g. an "AI-extended"
  add-on library)

**Cons**
- Biggest engineering scope (~1 week): new schema, new loader path,
  CMS UI, change-history surfaces
- Loses "rules in git" entirely — replaces it with a DB-backed audit
  trail (which has different defensibility properties)
- Backup-and-restore semantics get more important — a botched DB
  restore could lose rules content
- Initial migration: convert existing 9 YAML files into seed rows

## Recommendation

**Stay with Option A for now. Plan for Option B when the cadence
crosses ~1 rules edit per month or when sector-calibration content
authoring volume increases.**

Reasoning:

1. **Current scope doesn't justify the engineering cost.** 9 files,
   maybe a handful of edits per quarter. Option B is a week of
   engineering; Option C is two. Option A is zero.
2. **Git-as-source-of-truth is a real defensibility benefit.** A
   regulator asking "show me the rule that produced this finding in
   2026-Q1" gets a clean answer from `git log rules/`. Both B and C
   need to recreate that audit trail to match.
3. **Option C's biggest pro (per-tenant pinning) isn't urgent.** The
   trend chart's discontinuity marker tells customers when their score
   compares across rule versions; that's enough until customers
   actually complain about retroactive rule changes.
4. **Option B is a clean step up when needed.** Designing for it now
   isn't useful — by the time we need it, real authoring volume will
   tell us what the workflow should look like.

## What to do today (Option A formalized)

Even if the answer is "stay in the Docker image," the current state
benefits from a few small clarifications:

1. **Document the rules-edit workflow in `docs/`.** A short runbook —
   "to update a recommendation: edit the YAML, run `pytest`, open a
   PR, ping privacy-practice review, merge, deploy" — so the cadence
   is at least clear.
2. **Add a CI check that fails any PR removing or renaming a question
   id.** The original audit (H11) called this out. Trivial to add as
   a `tests/test_question_id_stability.py` that compares the previous
   git-stored question_id list against the current one.
3. **Tag releases of the rules library in git.** A `rules-v2026-04`
   git tag at each promotion makes the audit trail easier to navigate
   than digging through commit history.
4. **Surface `rules_version` and a "what changed" summary in the
   garabyte_admin admin console.** Reuses the existing
   `RulesLibrary.version` hash; just needs a small UI that compares
   the active library to the prior one.

These are ~2 hours of engineering total — much smaller than B or C —
and they keep Option A viable for longer.

## Decisions Garabyte needs to make

1. **Approve Option A (status quo + small clarifications), OR pick B
   or C now.**
2. **If Option A:** confirm the rules-edit cadence the privacy practice
   expects. If it's >1 edit/month, revisit.
3. **If Option B or C:** allocate engineering time (1–2 weeks
   respectively) and confirm the operational model (who promotes
   staging → prod in B; who has CMS-edit access in C).
4. **Either way:** approve the four Option-A clarifications above as a
   small follow-on PR. They're useful regardless of the long-term
   choice.

## Estimate

- Option A formalization (workflow doc + question_id CI check + git
  tags + admin console rules-version surface): ~2 hours.
- Option B implementation: ~5 days plus an operational handoff.
- Option C implementation: ~10 days plus a CMS UI design pass and a
  migration story for the existing 9 YAMLs.
