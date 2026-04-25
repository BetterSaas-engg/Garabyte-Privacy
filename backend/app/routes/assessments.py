"""Assessment lifecycle endpoints -- create, submit responses, score, fetch result."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Tenant, Assessment, Response
from ..schemas import (
    AssessmentCreate,
    AssessmentOut,
    AssessmentResultOut,
    BulkResponsesSubmit,
    BulkResponsesResult,
)
from ..services.scoring import score_assessment


# Two routers: one scoped under /tenants (for creation),
# one scoped under /assessments (for the rest of the lifecycle).
# This keeps URLs RESTful without forcing weird paths.
tenants_router = APIRouter(prefix="/tenants", tags=["assessments"])
assessments_router = APIRouter(prefix="/assessments", tags=["assessments"])


@tenants_router.post(
    "/{tenant_id}/assessments",
    response_model=AssessmentOut,
    status_code=201,
)
def create_assessment(
    tenant_id: int,
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
):
    """Start a new assessment for a tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, f"Tenant {tenant_id} not found")

    assessment = Assessment(
        tenant_id=tenant_id,
        label=payload.label,
        status="in_progress",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@assessments_router.get("/{assessment_id}", response_model=AssessmentOut)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Get one assessment's status and scores."""
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    return a


@assessments_router.post(
    "/{assessment_id}/responses",
    response_model=BulkResponsesResult,
)
def submit_responses(
    assessment_id: int,
    payload: BulkResponsesSubmit,
    db: Session = Depends(get_db),
):
    """
    Submit responses in bulk. Upsert logic: if a response already exists for
    a question, update it; otherwise create a new one. The frontend can
    auto-save as the user moves through the questionnaire without having to
    track which answers are new vs edited.

    Rejects submission if the assessment is already completed.
    """
    # Lazy import to avoid circular with main.py
    from ..main import RULES

    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id
    ).first()
    if not assessment:
        raise HTTPException(404, "Assessment not found")
    if assessment.status == "completed":
        raise HTTPException(400, "Assessment is already completed")

    known_qids = {q.id for d in RULES.dimensions for q in d.questions}
    created, updated = 0, 0

    for r in payload.responses:
        if r.question_id not in known_qids:
            raise HTTPException(400, f"Unknown question ID: {r.question_id}")

        existing = db.query(Response).filter(
            Response.assessment_id == assessment_id,
            Response.question_id == r.question_id,
        ).first()

        if existing:
            existing.value = r.value
            existing.note = r.note
            existing.evidence_url = r.evidence_url
            existing.answered_at = datetime.utcnow()
            updated += 1
        else:
            db.add(Response(
                assessment_id=assessment_id,
                question_id=r.question_id,
                value=r.value,
                note=r.note,
                evidence_url=r.evidence_url,
            ))
            created += 1

    db.commit()
    return BulkResponsesResult(created=created, updated=updated)


@assessments_router.post(
    "/{assessment_id}/score",
    response_model=AssessmentResultOut,
)
def finalize_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """
    Finalize an in-progress assessment: run the scoring engine, persist the
    full result, mark as completed.

    Idempotent on completed assessments -- if called again, returns the
    existing result instead of rescoring.
    """
    from ..main import RULES

    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id
    ).first()
    if not assessment:
        raise HTTPException(404, "Assessment not found")

    # Already scored -> return existing
    if assessment.status == "completed" and assessment.result_json:
        return AssessmentResultOut(
            assessment=assessment,
            result=assessment.result_json,
        )

    responses = {r.question_id: r.value for r in assessment.responses}
    if not responses:
        raise HTTPException(400, "No responses submitted yet")

    evidence_provided = {
        r.question_id: bool(r.evidence_url) for r in assessment.responses
    }
    result = score_assessment(RULES, responses, evidence_provided)
    result_dict = result.to_dict()

    assessment.overall_score = result.overall_score
    assessment.overall_maturity = result.overall_maturity_label
    assessment.result_json = result_dict
    assessment.status = "completed"
    assessment.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(assessment)

    return AssessmentResultOut(assessment=assessment, result=result_dict)


@assessments_router.get(
    "/{assessment_id}/result",
    response_model=AssessmentResultOut,
)
def get_result(assessment_id: int, db: Session = Depends(get_db)):
    """Retrieve the scored result for a completed assessment."""
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    if a.status != "completed" or not a.result_json:
        raise HTTPException(400, "Assessment has not been scored yet")
    return AssessmentResultOut(assessment=a, result=a.result_json)
