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
