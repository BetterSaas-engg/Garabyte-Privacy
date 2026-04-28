"""
Cascade FK enforcement (audit C72d7cb migration) + PDF export (Round 2
of strategic work).
"""
from datetime import datetime

from sqlalchemy import text


def test_raw_sql_delete_tenant_cascades_to_assessments(db_session):
    """
    Audit C72d7cb hardened FKs to ondelete=CASCADE. Without that, a raw
    SQL DELETE FROM tenants raises a FK violation. With it, dependents
    cascade away — the regression-test version of the audit fix.
    """
    from app.database import engine
    from app.models import Assessment, Response, Tenant

    t = Tenant(slug="raw-del", name="raw-del", sector="other")
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    a = Assessment(tenant_id=t.id, label="x", status="in_progress")
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    db_session.add(Response(assessment_id=a.id, question_id="d1_q1", value=2))
    db_session.commit()
    tid = t.id

    # Use a raw connection — bypasses ORM cascade entirely. This is the
    # path the audit said was broken.
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.execute(text("DELETE FROM tenants WHERE id = :tid"), {"tid": tid})

    # Force-refresh: open a new session so we don't see stale ORM state.
    from app.database import SessionLocal
    fresh = SessionLocal()
    try:
        assert fresh.query(Tenant).filter(Tenant.id == tid).count() == 0
        assert fresh.query(Assessment).filter(Assessment.tenant_id == tid).count() == 0
        # Raw count via SQL because the cascade went through the FK, not the ORM.
        n_resp = fresh.execute(text(
            "SELECT COUNT(*) FROM responses WHERE assessment_id "
            "NOT IN (SELECT id FROM assessments)"
        )).scalar()
        assert n_resp == 0
    finally:
        fresh.close()


def test_pdf_export_returns_pdf_bytes(db_session, test_client):
    """
    Round 2 strategic: GET /assessments/{id}/report.pdf streams a real
    PDF for a published assessment, refuses for unpublished.
    """
    from app.models import (
        User, OrgMembership, Tenant, Assessment, AssessmentPublication, Finding,
        ROLE_ORG_ADMIN, FINDING_SOURCE_ENGINE,
    )
    from app.auth.service import create_session, hash_password
    import hashlib

    def template_id(d, s, t):
        return hashlib.sha256(f"{d}|{s}|{t}".encode()).hexdigest()[:12]

    tenant = Tenant(slug="pdf-test", name="PDF Test", sector="other",
                    jurisdiction="Ontario, Canada")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    user = User(email="pdf@example.com",
                email_verified_at=datetime.utcnow(),
                password_hash=hash_password("correcthorse1234"))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    db_session.add(OrgMembership(user_id=user.id, org_id=tenant.id, role=ROLE_ORG_ADMIN))
    a = Assessment(
        tenant_id=tenant.id, label="Q1 Test", status="completed",
        completed_at=datetime.utcnow(),
        overall_score=2.30, overall_maturity="Developing",
        result_json={
            "dimension_scores": [
                {"dimension_id": "d1", "dimension_name": "Governance",
                 "score": 3.2, "maturity_label": "Managed"},
            ],
            "rules_version": "abc123",
        },
    )
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    pub = AssessmentPublication(assessment_id=a.id, version=1,
                                cover_note="cover")
    db_session.add(pub)
    db_session.add(Finding(
        assessment_id=a.id, dimension_id="d2", severity="high",
        finding_text="Inventory gaps in marketing systems",
        recommendation="Map flows in HubSpot.",
        finding_template_id=template_id("d2", "high", "Inventory gaps"),
        source=FINDING_SOURCE_ENGINE, score=1.8,
    ))
    db_session.commit()
    sess = create_session(db_session, user.id)
    db_session.commit()
    test_client.cookies.set("gp_session", sess.id)

    # Published → 200, real PDF bytes
    r = test_client.get(f"/assessments/{a.id}/report.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    assert "attachment" in r.headers.get("content-disposition", "")
    assert r.headers.get("x-content-type-options") == "nosniff"

    # Unpublish → 400
    pub.unpublished_at = datetime.utcnow()
    db_session.commit()
    r2 = test_client.get(f"/assessments/{a.id}/report.pdf")
    assert r2.status_code == 400
