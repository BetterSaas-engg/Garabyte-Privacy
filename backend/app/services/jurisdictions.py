"""
Jurisdiction codes + regulation-to-jurisdiction map (audit M22).

Used by `regulation_applies_to(regulation_name, tenant_codes)` to decide
whether a regulatory citation should appear in a tenant's report. Empty
or null `tenant_codes` is treated as "show everything" so the data can
be populated incrementally without breaking existing reports.

Codes follow ISO 3166 conventions extended for federal vs sub-national:
  CA      - Canada (federal)
  CA-ON   - Ontario
  CA-QC   - Quebec
  EU      - European Union
  US      - United States (federal)
  US-CA   - California
"""

from __future__ import annotations

from typing import Iterable, Optional

# Map from the regulation name as it appears in YAML regulatory_anchors
# to the list of jurisdiction codes the regulation applies to. Anchored
# in real legal scope:
#   PIPEDA: Canadian federal private-sector privacy law
#   Quebec Law 25 (formerly Bill 64): Quebec only
#   CASL: Canadian federal anti-spam
#   GDPR: EU
#   CCPA: California only (sub-national US)
#   AIDA: Canadian federal proposed AI law
REGULATION_JURISDICTIONS: dict[str, list[str]] = {
    "PIPEDA": ["CA"],
    "Quebec Law 25": ["CA-QC"],
    "CASL": ["CA"],
    "GDPR": ["EU"],
    "CCPA": ["US-CA"],
    "AIDA": ["CA"],
}

# All jurisdiction codes the platform recognizes today. Frontend uses
# this to render the tenant-creation multiselect.
KNOWN_JURISDICTION_CODES: list[tuple[str, str]] = [
    ("CA",     "Canada (federal)"),
    ("CA-ON",  "Ontario"),
    ("CA-QC",  "Quebec"),
    ("CA-BC",  "British Columbia"),
    ("CA-AB",  "Alberta"),
    ("EU",     "European Union"),
    ("US",     "United States (federal)"),
    ("US-CA",  "California"),
    ("US-NY",  "New York"),
    ("UK",     "United Kingdom"),
]


def applicable_regulations(tenant_codes: Optional[Iterable[str]]) -> set[str]:
    """
    Return the set of regulation names whose jurisdiction list intersects
    the tenant's jurisdiction codes (with sub-national → federal inheritance).
    Empty/null tenant_codes → every known regulation, plus the implicit
    "no filtering" semantics: callers should treat the full set as
    "everything passes."
    """
    if not tenant_codes:
        return set(REGULATION_JURISDICTIONS.keys())
    tenant_set: set[str] = set()
    for code in tenant_codes:
        tenant_set.add(code)
        if "-" in code:
            tenant_set.add(code.split("-", 1)[0])
    return {
        reg
        for reg, codes in REGULATION_JURISDICTIONS.items()
        if any(c in tenant_set for c in codes)
    }


def filter_regulatory_text(
    text: Optional[str],
    tenant_codes: Optional[Iterable[str]],
) -> Optional[str]:
    """
    Free-form regulatory_risk strings name regulations inline ("PIPEDA
    Principle 1…", "Quebec Law 25 s.27…"). At YAML-author time, the
    regulation list isn't structured — but we can detect mentions and
    suppress the whole string if every named regulation is out-of-scope.

    Behavior:
      - text is None / empty → return as-is.
      - tenant_codes is None / empty → return as-is (no filtering).
      - text mentions zero known regulations → return as-is (we err on the
        side of showing the finding rather than blanking it; the prose
        may still be useful even without a citation).
      - text mentions only out-of-scope regulations → return None (suppress).
      - otherwise → return as-is.

    Imperfect; the right long-term fix is structured regulation_names on
    each remediation entry. But this closes the worst case (a US-only
    customer's board-shared report citing Quebec Law 25).
    """
    if not text or not tenant_codes:
        return text
    mentioned = {reg for reg in REGULATION_JURISDICTIONS if reg in text}
    if not mentioned:
        return text
    applicable = applicable_regulations(tenant_codes)
    if mentioned & applicable:
        return text
    return None


def regulation_applies_to(
    regulation_name: str,
    tenant_codes: Optional[Iterable[str]],
) -> bool:
    """
    Return True if the regulation should be cited for a tenant whose
    jurisdiction_codes is `tenant_codes`. Sub-national codes (CA-QC)
    inherit federal codes (CA): a Quebec-based tenant matches both
    PIPEDA (federal) and Law 25 (provincial).

    Empty/null tenant_codes -> True (no filtering yet; show everything).
    Unknown regulation -> True (preserves existing behavior for citations
    we haven't mapped).
    """
    if not tenant_codes:
        return True
    reg_codes = REGULATION_JURISDICTIONS.get(regulation_name)
    if reg_codes is None:
        return True
    tenant_set = set()
    for code in tenant_codes:
        tenant_set.add(code)
        # Sub-national to federal: CA-QC implies CA
        if "-" in code:
            tenant_set.add(code.split("-", 1)[0])
    return any(c in tenant_set for c in reg_codes)
