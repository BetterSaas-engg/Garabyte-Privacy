"""
Smoke test for the database layer.

Creates tables, writes a tenant with one assessment and a few responses,
reads it all back out via the relationships, verifies the scoring engine
result_json round-trips correctly, then cleans up.

Run from the backend/ directory:
    python test_database.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, init_db, engine, DATABASE_URL
from app.models import Tenant, Assessment, Response
from app.services.rules_loader import load_rules_library
from app.services.scoring import score_assessment


def main():
    print(f"Using database: {DATABASE_URL}")
    print("Creating tables...")
    init_db()
    print("[OK] Tables created (or already existed)")

    db = SessionLocal()
    try:
        # --- Clean any previous test data ---
        existing = db.query(Tenant).filter(Tenant.slug == "test-tenant").first()
        if existing:
            db.delete(existing)
            db.commit()
            print("[OK] Cleaned up previous test tenant")

        # --- Write a tenant ---
        t = Tenant(
            slug="test-tenant",
            name="Test Tenant Co.",
            sector="utility",
            jurisdiction="Ontario, Canada",
            employee_count=100,
            is_demo=0,
        )
        db.add(t)
        db.commit()
        db.refresh(t)
        print(f"[OK] Created tenant: {t}")

        # --- Write an assessment with a few responses ---
        a = Assessment(tenant_id=t.id, label="Smoke test run", status="in_progress")
        db.add(a)
        db.commit()
        db.refresh(a)

        # Just a handful of responses -- enough to score
        responses_data = [
            ("d1_q1", 3), ("d1_q2", 2), ("d1_q3", 2), ("d1_q4", 2), ("d1_q5", 3),
        ]
        for qid, val in responses_data:
            db.add(Response(assessment_id=a.id, question_id=qid, value=val))
        db.commit()
        print(f"[OK] Created assessment with {len(responses_data)} responses")

        # --- Read back through the relationships ---
        t_reloaded = db.query(Tenant).filter(Tenant.slug == "test-tenant").first()
        print(f"[OK] Reloaded tenant: {t_reloaded}")
        print(f"     Assessments on this tenant: {len(t_reloaded.assessments)}")
        a_reloaded = t_reloaded.assessments[0]
        print(f"     Responses on first assessment: {len(a_reloaded.responses)}")

        # --- Run the scoring engine against responses pulled from DB ---
        rules = load_rules_library(Path(__file__).parent.parent / "rules")
        responses_dict = {r.question_id: r.value for r in a_reloaded.responses}
        result = score_assessment(rules, responses_dict)
        print(f"[OK] Scored the partial assessment: d1 score = {result.dimension_scores[0].score:.2f}")

        # --- Store result_json and round-trip it ---
        a_reloaded.status = "completed"
        a_reloaded.overall_score = result.overall_score
        a_reloaded.overall_maturity = result.overall_maturity_label
        a_reloaded.result_json = result.to_dict()
        db.commit()
        db.refresh(a_reloaded)

        assert a_reloaded.result_json is not None
        assert "overall_score" in a_reloaded.result_json
        print(f"[OK] result_json persisted and readable: overall_score={a_reloaded.result_json['overall_score']}")

        # --- Clean up ---
        db.delete(t_reloaded)
        db.commit()
        print("[OK] Cleaned up test tenant (cascade deleted assessment and responses)")

        # Confirm cascade worked
        remaining = db.query(Assessment).filter(Assessment.tenant_id == t.id).all()
        assert remaining == []
        print("[OK] Cascade delete confirmed -- no orphan assessments")

    finally:
        db.close()

    print("\nAll database checks passed.")


if __name__ == "__main__":
    main()
