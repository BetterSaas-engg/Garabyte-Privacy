"""Assessment lifecycle endpoints -- create, submit responses, score, fetch result. All require auth (Phase 3)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth.deps import ensure_membership, get_current_user
from ..auth.service import log_access
from ..database import get_db
from ..models import (
    Assessment,
    Response,
    ROLE_CONSULTANT,
    ROLE_ORG_ADMIN,
    ROLE_ORG_VIEWER,
    ROLE_SECTION_CONTRIBUTOR,
    Tenant,
    User,
)
from ..schemas import (
    AssessmentCreate,
    AssessmentOut,
    AssessmentResultOut,
    BulkResponsesSubmit,
    BulkResponsesResult,
)
from ..services.scoring import score_assessment


# Two routers: one scoped under /tenants (for creation), one scoped under
# /assessments (for the rest of the lifecycle). Same routing as before --
# auth was added without changing the URL surface.
tenants_router = APIRouter(prefix="/tenants", tags=["assessments"])
assessments_router = APIRouter(prefix="/assessments", tags=["assessments"])


# Roles per R&P (loose for Phase 3; tighter scoping is Phase 5 work):
# - Reading anything tenant-scoped: any role with membership in that tenant.
# - Writing answers / starting an assessment: org_admin or section_contributor.
# - Finalizing (scoring): org_admin only.
_ASSESSMENT_READ_ROLES = (
    ROLE_ORG_ADMIN, ROLE_SECTION_CONTRIBUTOR, ROLE_ORG_VIEWER, ROLE_CONSULTANT,
)
_ASSESSMENT_WRITE_ROLES = (ROLE_ORG_ADMIN, ROLE_SECTION_CONTRIBUTOR)
_ASSESSMENT_FINALIZE_ROLES = (ROLE_ORG_ADMIN,)


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _load_assessment_or_404(db: Session, assessment_id: int) -> Assessment:
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    return a


@tenants_router.post(
    "/{tenant_id}/assessments",
    response_model=AssessmentOut,
    status_code=201,
)
def create_assessment(
    tenant_id: int,
    payload: AssessmentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a new assessment for a tenant. Requires org_admin membership."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, f"Tenant {tenant_id} not found")
    ensure_membership(
        db, user, tenant_id,
        roles=_ASSESSMENT_FINALIZE_ROLES,  # only org_admin starts assessments
        request=request,
        action="assessment.create.check",
    )

    assessment = Assessment(
        tenant_id=tenant_id,
        label=payload.label,
        status="in_progress",
    )
    db.add(assessment)
    db.flush()
    log_access(db, user_id=user.id, org_id=tenant_id, action="assessment.create",
               resource_kind="assessment", resource_id=assessment.id, ip=_ip(request))
    db.commit()
    db.refresh(assessment)
    return assessment


@assessments_router.get("/{assessment_id}", response_model=AssessmentOut)
def get_assessment(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get one assessment's status and scores. Requires membership in the tenant."""
    a = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_ASSESSMENT_READ_ROLES,
        request=request,
        action="assessment.read.check",
    )
    log_access(db, user_id=user.id, org_id=a.tenant_id, action="assessment.read",
               resource_kind="assessment", resource_id=a.id, ip=_ip(request))
    db.commit()
    return a


@assessments_router.post(
    "/{assessment_id}/responses",
    response_model=BulkResponsesResult,
)
def submit_responses(
    assessment_id: int,
    payload: BulkResponsesSubmit,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit responses in bulk. Upsert logic: if a response already exists for
    a question, update it; otherwise create a new one. The frontend can
    auto-save as the user moves through the questionnaire without having to
    track which answers are new vs edited.

    Rejects submission if the assessment is already completed.

    Requires org_admin or section_contributor membership. Section contributor
    dimension scoping (R&P C5) is enforced in Phase 5.
    """
    # Lazy import to avoid circular with main.py
    from ..main import RULES

    assessment = _load_assessment_or_404(db, assessment_id)
    if assessment.status == "completed":
        raise HTTPException(400, "Assessment is already completed")

    ensure_membership(
        db, user, assessment.tenant_id,
        roles=_ASSESSMENT_WRITE_ROLES,
        request=request,
        action="assessment.write.check",
    )

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

    log_access(db, user_id=user.id, org_id=assessment.tenant_id,
               action="assessment.responses.submit",
               resource_kind="assessment", resource_id=assessment.id,
               context={"created": created, "updated": updated}, ip=_ip(request))
    db.commit()
    return BulkResponsesResult(created=created, updated=updated)


@assessments_router.post(
    "/{assessment_id}/score",
    response_model=AssessmentResultOut,
)
def finalize_assessment(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Finalize an in-progress assessment: run the scoring engine, persist the
    full result, mark as completed.

    Idempotent on completed assessments -- if called again, returns the
    existing result instead of rescoring.

    Requires org_admin membership.
    """
    from ..main import RULES

    assessment = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, assessment.tenant_id,
        roles=_ASSESSMENT_FINALIZE_ROLES,
        request=request,
        action="assessment.score.check",
    )

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
    log_access(db, user_id=user.id, org_id=assessment.tenant_id,
               action="assessment.score",
               resource_kind="assessment", resource_id=assessment.id,
               context={"overall": result.overall_score}, ip=_ip(request))
    db.commit()
    db.refresh(assessment)

    return AssessmentResultOut(assessment=assessment, result=result_dict)


@assessments_router.get(
    "/{assessment_id}/result",
    response_model=AssessmentResultOut,
)
def get_result(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the scored result for a completed assessment. Requires membership."""
    a = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_ASSESSMENT_READ_ROLES,
        request=request,
        action="assessment.result.check",
    )
    if a.status != "completed" or not a.result_json:
        raise HTTPException(400, "Assessment has not been scored yet")
    log_access(db, user_id=user.id, org_id=a.tenant_id, action="assessment.result.read",
               resource_kind="assessment", resource_id=a.id, ip=_ip(request))
    db.commit()
    return AssessmentResultOut(assessment=a, result=a.result_json)
