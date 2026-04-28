"""
M22 jurisdiction filtering — covers the helper that powers the
share-link payload's regulation-suppression behavior.
"""
from app.services.jurisdictions import (
    applicable_regulations,
    filter_regulatory_text,
    regulation_applies_to,
)


def test_us_only_tenant_drops_quebec_law_25_citation():
    """The headline audit case: US-only customer shouldn't see Quebec Law 25."""
    text = "Quebec Law 25 s.27 requires defensible deletion."
    assert filter_regulatory_text(text, ["US", "US-CA"]) is None


def test_us_only_tenant_keeps_ccpa_citation():
    text = "CCPA $1798.105 grants the right to delete."
    assert filter_regulatory_text(text, ["US", "US-CA"]) == text


def test_quebec_tenant_keeps_quebec_law_25_citation():
    text = "Quebec Law 25 s.27 requires defensible deletion."
    assert filter_regulatory_text(text, ["CA", "CA-QC"]) == text


def test_subnational_inherits_federal():
    """A CA-QC tenant matches federal CA citations (PIPEDA, CASL, AIDA)."""
    assert "PIPEDA" in applicable_regulations(["CA-QC"])
    assert "CASL" in applicable_regulations(["CA-QC"])


def test_no_tenant_codes_means_pass_through():
    """Empty tenant_codes = 'show every citation' (no filtering yet)."""
    text = "Quebec Law 25 s.27"
    assert filter_regulatory_text(text, None) == text
    assert filter_regulatory_text(text, []) == text


def test_text_mentioning_no_known_regulations_passes_through():
    """A finding without a regulation citation is kept as-is."""
    text = "General best practice for data minimization."
    assert filter_regulatory_text(text, ["US"]) == text


def test_mixed_in_scope_and_out_of_scope_keeps_text():
    """If text mentions BOTH an in-scope and an out-of-scope regulation, keep it."""
    text = "PIPEDA and CCPA both require this."
    assert filter_regulatory_text(text, ["US", "US-CA"]) == text


def test_regulation_applies_to_helper():
    assert regulation_applies_to("PIPEDA", ["CA"]) is True
    assert regulation_applies_to("PIPEDA", ["US"]) is False
    assert regulation_applies_to("Unknown reg", ["US"]) is True  # unknown → permissive
    assert regulation_applies_to("PIPEDA", None) is True  # null = no filter
