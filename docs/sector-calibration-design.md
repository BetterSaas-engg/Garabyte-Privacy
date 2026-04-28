# Sector & size calibration — design proposal

## Problem

The current rules library applies one set of expectations to every tenant.
A 30-person SaaS scoring 1.5 in `d1 Governance` gets the same finding text
("Roles, policies, and oversight that make decisions defensible — gaps")
as a 10,000-person enterprise at the same score. But the *appropriate*
remediation is wildly different:

- The 30-person SaaS shouldn't be told to "establish a board-level privacy
  committee with quarterly reporting." They should be told to "name a
  privacy lead and document their scope."
- The 10,000-person enterprise shouldn't be congratulated for "naming a
  privacy lead" — that's a baseline expectation.

The audit's M-tier item asked us to think about this:

> Calibration to organization size and sector — current "Optimized"
> descriptions assume enterprise tooling. A 30-person SaaS will
> systematically underscore. Either alternate maturity ceilings per
> sector profile, or a profile-aware weighting layer.

This document enumerates options. **Pick one, and Garabyte's privacy
practice authors the calibration content; engineering implements the
chosen mechanism.**

## What we already know about the tenant

`Tenant` already carries:

- `sector` — `utility | healthcare | telecom | other` (extensible)
- `employee_count` — integer 1–10,000,000
- `jurisdiction_codes` — used for M22 regulatory filtering, separate concern

These are sufficient inputs for any calibration scheme below.

## Three options

### Option A — Sector-aware remediation overrides

Keep the dimension scoring exactly as it is. Add an optional
`sector_overrides` block on each remediation entry that lets a sector get
different `recommendation` / `regulatory_risk` / `typical_consulting_hours`
text without changing whether the finding fires.

```yaml
# In rules/d1_governance_accountability.yaml
gap_remediation_library:
  - score_max: 1.5
    severity: critical
    finding: Privacy governance is essentially absent
    recommendation: >
      Default text — establish a board-level privacy committee with
      quarterly reporting…
    sector_overrides:
      saas:
        recommendation: >
          Name a privacy lead and document their scope. A formal committee
          can wait until you cross 100 people.
        typical_consulting_hours: 8
      utility:
        recommendation: >
          Default text adjusted for utility-regulator expectations…
```

**Pros**
- Smallest schema change (single new key, optional)
- Same finding fires regardless of sector — keeps trend tracking
  comparable
- Garabyte authors content per-sector at the recommendation level, where
  it matters most
- No size-band concept needed; sector is the dominant signal

**Cons**
- Doesn't address the "30-person SaaS at score 2 looks worse than they
  are" problem at the score level — the customer still sees their score
  next to a generic Defined/Managed/Optimized label
- Requires Garabyte to author overrides for every (sector × dimension)
  combination they care about. Up-front content cost: ~8 dimensions ×
  ~5 sectors × ~5 score ranges = ~200 entries (most can copy the default)

### Option B — Sector-aware maturity ceilings

For each sector, define what the maturity-level *labels* mean. A 30-person
SaaS at score 2 sees a Defined label, but the description text reads "a
defensible-for-this-scale privacy program." A 10,000-person enterprise at
score 2 sees the same label but description text reads "underwhelming for
an organization at this scale."

```yaml
# Optional sector calibration block at the rules-library root, or in a
# new rules/sector_calibration.yaml
sector_calibration:
  saas:
    size_bands:
      - max_employees: 50
        d1_label_overrides:
          2: Defined for early-stage SaaS — a privacy lead is named and
             documents are kept current
          3: Managed for early-stage SaaS — quarterly review cadence
             with engineering involvement
      - max_employees: 5000
        d1_label_overrides: {}  # default labels apply
  utility:
    size_bands:
      - max_employees: null  # no size dependence
        d1_label_overrides: {}
```

**Pros**
- Honest: same numeric score, different qualitative reading per
  sector × size
- Doesn't create false positives or change which findings fire
- Authoring scope is tractable (label text per (sector, size_band,
  dimension, level))

**Cons**
- Adds complexity to the report rendering layer (dimension
  breakdown table needs to look up label by sector + size)
- Trend tracking is preserved (scores are unchanged) but compare-against-
  peers gets harder
- Size-band buckets are a content decision Garabyte must make

### Option C — Sector-aware compound rules

Don't change scoring or labels. Instead, add new compound rules that fire
for specific sector × score patterns the existing rules miss.

```yaml
# rules/compound_rules.yaml additions
compound_rules:
  # ... existing c1–c6 ...

  - id: c7_saas_no_designated_owner
    severity: high
    finding: SaaS scale has outgrown ad-hoc privacy ownership
    conditions:
      - dimension: d1
        score_max: 2.0
    sector_constraints: [saas]
    size_constraints:
      min_employees: 50
      max_employees: 500
    recommendation: >
      Mid-stage SaaS scale (50–500 employees) is the inflection point at
      which ad-hoc privacy ownership stops scaling. Name a privacy lead
      with a documented scope before the next funding round, audit, or
      enterprise-customer DPA review forces it.
```

**Pros**
- Reuses the compound-rules infrastructure already in production
- Lowest schema change beyond Option A — just `sector_constraints` and
  `size_constraints` keys
- Garabyte's content investment is the smallest (only the cases where
  sector × size truly matters get a rule; everything else uses the
  existing per-dimension findings)
- Fires findings only when the pattern is real; doesn't pollute reports
  with sector overrides for tenants where the default is fine

**Cons**
- Doesn't fix the "Optimized at 30-person SaaS means something different"
  framing problem
- Requires net-new content authoring (the rules don't exist yet)
- More moving parts in the engine (sector and size guards on top of
  score conditions)

## Recommendation

**Start with Option C. Layer in Option A if it proves insufficient.**

Reasoning:

1. **Highest ROI per content unit.** The compound-rules infrastructure
   already exists. Adding a `sector_constraints` + `size_constraints`
   guard is ~15 lines of engine code. Garabyte's privacy practice writes
   ~5–10 sector-aware compound findings to start (the patterns they
   already raise verbally with clients), and the engine surfaces them.

2. **Doesn't muddy trend tracking.** Same scores, same labels, same
   per-dimension findings. The diff-since-prior panel keeps working
   without sector context.

3. **Honest about what's hard to do well.** Option B (label calibration)
   is the cleanest model in theory, but it requires Garabyte to author
   label text for every (sector × size × dimension × level) tuple — a
   lot of content debt for a v1.

4. **Composable.** If, after some real engagements, Garabyte finds a
   specific (sector, dimension) where the default recommendation is
   consistently wrong, layer in Option A overrides for that pair only.
   No need to author the full matrix up front.

5. **Doesn't block on a sector taxonomy decision.** Option C reuses the
   existing `tenant.sector` enum. Option A would too, but Option B
   forces a size-band taxonomy decision (≤50? 51–500? what about
   251?) that no one needs to make today.

## Implementation sketch (if Option C is approved)

Engine changes:

1. Extend `CompoundRule` with optional `sector_constraints: list[str]`
   and `size_constraints: dict | None` (with `min_employees` /
   `max_employees`, both optional).
2. Pass tenant context (`sector`, `employee_count`) into
   `score_assessment()`. Today the engine is tenant-agnostic — needs a
   small signature change. Or: filter compound findings post-scoring,
   in the route layer, where tenant context is available.
3. `_evaluate_compound_rules` skips a rule if its sector_constraints
   don't include the tenant's sector, or if the tenant's
   employee_count falls outside its size_constraints range.

Schema validation:

- Sector values in `sector_constraints` must match the
  `Tenant.sector` enum.
- `size_constraints.min_employees` ≤ `max_employees` if both set.
- Either `sector_constraints` is non-empty OR `size_constraints` is
  non-empty (a rule with neither is the same as a normal compound
  rule — author it without the guards).

UI:

- The customer-facing "Cross-cutting findings" panel already renders
  compound findings. No change needed; sector-aware findings show up
  in the same panel as long as they fire.
- The consultant console shows the rule id (e.g.
  `c7_saas_no_designated_owner`) so the consultant can tell at a glance
  this is a sector-conditional finding.

Test coverage:

- Unit tests in `tests/test_scoring_engine.py` for each new constraint
  combination — fires for matching sector + size, doesn't fire for
  mismatch.

## Estimate

Engine + tests: ~½ day. Authoring 5–10 sector-aware compound rules with
Garabyte: a session with the privacy practice, then ~2 hours to encode.

## Decisions Garabyte needs to make

1. **Approve Option C, OR pick A or B instead.**
2. **Initial sector list to support.** Today: `utility`, `healthcare`,
   `telecom`, `other`. Add `saas`, `financial_services`, `non_profit`?
3. **Initial size bands (only if Options B or C with size_constraints).**
   Suggested: `≤50` / `51–500` / `501–5000` / `5000+`. Confirm or
   adjust.
4. **Authoring cadence.** Are sector-aware rules part of the next
   rules-library refresh, or a follow-on after first customer feedback?
