"""
Seed script -- populates the database with three synthetic demo tenants.

Each tenant represents a different sector Garabyte serves. Each has two
completed assessments (historical + current) so the dashboard can show
improvement over time.

Sector profiles are intentionally realistic:
- Utilities: strong governance/breach, weak vendor/AI
- Healthcare: strong consent/rights, weak training, nascent AI
- Telecom: strong across the board, weakness only in AI governance

Run from the backend/ directory with the venv active:
    python -m app.seed
"""

from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from .database import SessionLocal, init_db
from .models import Tenant, Assessment, Response
from .services.rules_loader import load_rules_library
from .services.scoring import score_assessment


# -----------------------------------------------------------------------------
# Sector profiles -- each dict maps question_id to a score 0-4
# These are the CURRENT quarter's responses. Historical responses are derived
# by subtracting 1 from a selection of questions (capped at 0) to simulate
# "we fixed some things since last quarter".
# -----------------------------------------------------------------------------

SYNTHETIC_PROFILES = {
    "northwind-utilities": {
        "name": "Northwind Utilities",
        "sector": "utility",
        "jurisdiction": "Ontario & Quebec, Canada",
        "employee_count": 450,
        "response_pattern": {
            # D1 Governance: strong (avg 2.8) - regulators audit utilities
            "d1_q1": 3, "d1_q2": 3, "d1_q3": 3, "d1_q4": 2, "d1_q5": 3,
            # D2 Data inventory: mid (avg 2.2)
            "d2_q1": 2, "d2_q2": 2, "d2_q3": 3, "d2_q4": 2, "d2_q5": 2,
            # D3 Consent: mid-high (avg 2.6)
            "d3_q1": 3, "d3_q2": 3, "d3_q3": 2, "d3_q4": 3, "d3_q5": 2,
            # D4 Rights: mid (avg 1.8)
            "d4_q1": 2, "d4_q2": 2, "d4_q3": 1, "d4_q4": 2, "d4_q5": 2,
            # D5 Vendor: weak (avg 1.2) - SCADA + metering vendor sprawl
            "d5_q1": 2, "d5_q2": 1, "d5_q3": 1, "d5_q4": 1, "d5_q5": 1,
            # D6 Breach: strong (avg 2.8) - utilities are drilled on this
            "d6_q1": 3, "d6_q2": 3, "d6_q3": 3, "d6_q4": 2, "d6_q5": 3,
            # D7 Training: mid (avg 2.4)
            "d7_q1": 3, "d7_q2": 2, "d7_q3": 2, "d7_q4": 3, "d7_q5": 2,
            # D8 Privacy by Design / AI: weak (avg 0.8) - the upsell hook
            "d8_q1": 1, "d8_q2": 1, "d8_q3": 0, "d8_q4": 1, "d8_q5": 1,
        },
    },

    "meridian-health": {
        "name": "Meridian Health Network",
        "sector": "healthcare",
        "jurisdiction": "Ontario, Canada",
        "employee_count": 1200,
        "response_pattern": {
            # D1 Governance: strong (avg 3.2)
            "d1_q1": 4, "d1_q2": 3, "d1_q3": 3, "d1_q4": 3, "d1_q5": 3,
            # D2 Data inventory: strong (avg 3.0) - PHIPA drives this
            "d2_q1": 3, "d2_q2": 3, "d2_q3": 3, "d2_q4": 3, "d2_q5": 3,
            # D3 Consent: very strong (avg 3.4) - patient consent is daily
            "d3_q1": 4, "d3_q2": 3, "d3_q3": 4, "d3_q4": 3, "d3_q5": 3,
            # D4 Rights: strong (avg 3.2) - patients request records often
            "d4_q1": 4, "d4_q2": 3, "d4_q3": 3, "d4_q4": 3, "d4_q5": 3,
            # D5 Vendor: mid (avg 2.0)
            "d5_q1": 3, "d5_q2": 2, "d5_q3": 2, "d5_q4": 1, "d5_q5": 2,
            # D6 Breach: mid-strong (avg 2.6)
            "d6_q1": 3, "d6_q2": 2, "d6_q3": 3, "d6_q4": 3, "d6_q5": 2,
            # D7 Training: weak (avg 1.6) - clinical staff are hard to train
            "d7_q1": 2, "d7_q2": 2, "d7_q3": 1, "d7_q4": 2, "d7_q5": 1,
            # D8 AI governance: weak but not zero (avg 1.4) - AI triage pilot
            "d8_q1": 2, "d8_q2": 2, "d8_q3": 1, "d8_q4": 1, "d8_q5": 1,
        },
    },

    "cascade-telecom": {
        "name": "Cascade Telecommunications",
        "sector": "telecom",
        "jurisdiction": "Canada (national)",
        "employee_count": 3500,
        "response_pattern": {
            # D1 Governance: very strong (avg 3.8)
            "d1_q1": 4, "d1_q2": 4, "d1_q3": 4, "d1_q4": 3, "d1_q5": 4,
            # D2 Data inventory: strong (avg 3.2)
            "d2_q1": 4, "d2_q2": 3, "d2_q3": 3, "d2_q4": 3, "d2_q5": 3,
            # D3 Consent: very strong (avg 3.6) - CASL experts
            "d3_q1": 4, "d3_q2": 4, "d3_q3": 3, "d3_q4": 4, "d3_q5": 3,
            # D4 Rights: strong (avg 3.0)
            "d4_q1": 3, "d4_q2": 3, "d4_q3": 3, "d4_q4": 3, "d4_q5": 3,
            # D5 Vendor: mid-strong (avg 2.6)
            "d5_q1": 3, "d5_q2": 3, "d5_q3": 2, "d5_q4": 2, "d5_q5": 3,
            # D6 Breach: very strong (avg 3.6) - SIM swap + other incidents
            "d6_q1": 4, "d6_q2": 4, "d6_q3": 4, "d6_q4": 3, "d6_q5": 3,
            # D7 Training: strong (avg 3.0)
            "d7_q1": 4, "d7_q2": 3, "d7_q3": 3, "d7_q4": 3, "d7_q5": 2,
            # D8 AI governance: mid (avg 1.8) - piloting customer-service AI
            "d8_q1": 2, "d8_q2": 2, "d8_q3": 2, "d8_q4": 2, "d8_q5": 1,
        },
    },
}


def _derive_historical_pattern(current: dict[str, int]) -> dict[str, int]:
    """
    Create a historical response pattern that is slightly weaker than current.
    Subtracts 1 from questions whose IDs end in _q3 or _q5 (to simulate
    specific gaps that got addressed between quarters), capped at 0.
    """
    historical = {}
    for qid, val in current.items():
        if qid.endswith("_q3") or qid.endswith("_q5"):
            historical[qid] = max(0, val - 1)
        else:
            historical[qid] = val
    return historical


def seed_tenant(
    db: Session,
    rules,
    slug: str,
    profile: dict,
) -> Tenant:
    """
    Create or replace a single synthetic tenant with historical + current
    completed assessments.
    """
    # Wipe any existing tenant with this slug (fresh seed every run)
    existing = db.query(Tenant).filter(Tenant.slug == slug).first()
    if existing:
        db.delete(existing)
        db.commit()

    tenant = Tenant(
        slug=slug,
        name=profile["name"],
        sector=profile["sector"],
        jurisdiction=profile["jurisdiction"],
        employee_count=profile["employee_count"],
        is_demo=1,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    # --- Historical assessment (Q4 2025) ---
    historical_pattern = _derive_historical_pattern(profile["response_pattern"])

    historical = Assessment(
        tenant_id=tenant.id,
        label="Q4 2025 Review",
        status="completed",
        started_at=datetime.utcnow() - timedelta(days=100),
        completed_at=datetime.utcnow() - timedelta(days=92),
    )
    db.add(historical)
    db.commit()
    db.refresh(historical)

    for qid, val in historical_pattern.items():
        db.add(Response(
            assessment_id=historical.id,
            question_id=qid,
            value=val,
            answered_at=historical.completed_at,
        ))
    db.commit()

    hist_result = score_assessment(rules, historical_pattern)
    historical.overall_score = hist_result.overall_score
    historical.overall_maturity = hist_result.overall_maturity_label
    historical.result_json = hist_result.to_dict()
    db.commit()

    # --- Current assessment (Q1 2026) ---
    current = Assessment(
        tenant_id=tenant.id,
        label="Q1 2026 Review",
        status="completed",
        started_at=datetime.utcnow() - timedelta(days=7),
        completed_at=datetime.utcnow(),
    )
    db.add(current)
    db.commit()
    db.refresh(current)

    for qid, val in profile["response_pattern"].items():
        db.add(Response(
            assessment_id=current.id,
            question_id=qid,
            value=val,
            answered_at=current.completed_at,
        ))
    db.commit()

    current_result = score_assessment(rules, profile["response_pattern"])
    current.overall_score = current_result.overall_score
    current.overall_maturity = current_result.overall_maturity_label
    current.result_json = current_result.to_dict()
    db.commit()

    return tenant


def clear_api_test_tenant(db: Session) -> None:
    """Remove the leftover tenant from API smoke testing, if present."""
    leftover = db.query(Tenant).filter(Tenant.slug == "api-test").first()
    if leftover:
        db.delete(leftover)
        db.commit()
        print("[OK] Removed leftover api-test tenant")


def main() -> None:
    print("Initializing database...")
    init_db()

    rules_dir = Path(__file__).parent.parent.parent / "rules"
    rules = load_rules_library(rules_dir)
    print(f"[OK] Loaded {len(rules.dimensions)} dimensions from rules library")

    db = SessionLocal()
    try:
        clear_api_test_tenant(db)

        print("\nSeeding synthetic tenants...\n")
        print(f"  {'Slug':25} {'Sector':12} {'Historical':>12} {'Current':>12}  Delta")
        print(f"  {'-'*25} {'-'*12} {'-'*12:>12} {'-'*12:>12}  {'-'*5}")

        for slug, profile in SYNTHETIC_PROFILES.items():
            tenant = seed_tenant(db, rules, slug, profile)

            # Pull the two assessments back for reporting
            sorted_assessments = sorted(
                tenant.assessments,
                key=lambda a: a.completed_at or a.started_at,
            )
            historical = sorted_assessments[0]
            current = sorted_assessments[1]
            delta = current.overall_score - historical.overall_score

            print(
                f"  {slug:25} {profile['sector']:12} "
                f"{historical.overall_score:>6.2f} ({historical.overall_maturity[:8]:>8})  "
                f"{current.overall_score:>6.2f} ({current.overall_maturity[:8]:>8})  "
                f"+{delta:.2f}"
            )

        # Summary
        total_tenants = db.query(Tenant).filter(Tenant.is_demo == 1).count()
        total_assessments = db.query(Assessment).filter(
            Assessment.status == "completed"
        ).count()
        total_responses = db.query(Response).count()
        print(f"\n[OK] Seed complete:")
        print(f"     {total_tenants} demo tenants")
        print(f"     {total_assessments} completed assessments")
        print(f"     {total_responses} individual responses")
        print(f"\nStart the server with: uvicorn app.main:app --reload --port 8001")
        print(f"Then visit http://localhost:8001/tenants to see the demo tenants.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
