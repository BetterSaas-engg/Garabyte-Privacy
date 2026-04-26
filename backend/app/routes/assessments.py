"""Assessment lifecycle endpoints -- create, submit responses, score, fetch result. All require auth (Phase 3)."""

import hashlib
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth.deps import ensure_membership, get_current_user
from ..auth.service import log_access
from ..database import get_db
from ..models import (
    ANNOTATION_CONFIRMED,
    ANNOTATION_DISMISSED,
    ANNOTATION_REPLACED,
    ANNOTATION_SEVERITY_ADJUSTED,
    Assessment,
    AssessmentPublication,
    FINDING_SOURCE_CONSULTANT,
    FINDING_SOURCE_ENGINE,
    Finding,
    FindingAnnotation,
    Response,
    ROLE_CONSULTANT,
    ROLE_GARABYTE_ADMIN,
    ROLE_ORG_ADMIN,
    ROLE_ORG_VIEWER,
    ROLE_SECTION_CONTRIBUTOR,
    Tenant,
    User,
)
from ..schemas import (
    AnnotationCreate,
    AnnotationOut,
    AssessmentCreate,
    AssessmentOut,
    AssessmentResultOut,
    BulkResponsesSubmit,
    BulkResponsesResult,
    FindingOut,
    PublicationOut,
    PublishCreate,
    ResponseOut,
)
from pydantic import BaseModel, Field
from typing import Optional


class CustomFindingCreate(BaseModel):
    """Body for POST /assessments/{id}/findings (consultant adds finding)."""
    dimension_id: str = Field(..., min_length=1, max_length=16)
    severity: str = Field(..., min_length=1, max_length=16)
    finding_text: str = Field(..., min_length=1, max_length=8000)
    recommendation: Optional[str] = Field(None, max_length=8000)
    regulatory_risk: Optional[str] = Field(None, max_length=8000)
    typical_consulting_hours: Optional[int] = Field(None, ge=0, le=10000)


# Roles allowed to edit findings (R&P C13 — consultants only; garabyte admin
# elevates per C4)
_FINDING_EDIT_ROLES = (ROLE_CONSULTANT,)
from ..services.scoring import score_assessment


# Four routers: tenants for creation, assessments for the lifecycle,
# findings for top-level finding-id-scoped paths (annotations), and
# consultant for the cross-tenant engagement listing (Phase 6A).
tenants_router = APIRouter(prefix="/tenants", tags=["assessments"])
assessments_router = APIRouter(prefix="/assessments", tags=["assessments"])
findings_router = APIRouter(prefix="/findings", tags=["findings"])
consultant_router = APIRouter(prefix="/consultant", tags=["consultant"])


class EngagementOut(BaseModel):
    """One row in the consultant's engagement list."""
    tenant_id: int
    tenant_slug: str
    tenant_name: str
    tenant_sector: str
    tenant_jurisdiction: str
    tenant_employee_count: Optional[int] = None

    assessment_id: int
    assessment_label: Optional[str] = None
    assessment_status: str
    overall_score: Optional[float] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    # Counts driven by the consultant's working surface
    findings_total: int
    findings_unreviewed: int


def _engagement_counts(db: Session, assessment_id: int) -> tuple[int, int]:
    """Return (total findings, findings with no annotation yet)."""
    findings = (
        db.query(Finding)
        .filter(Finding.assessment_id == assessment_id)
        .all()
    )
    total = len(findings)
    unreviewed = sum(1 for f in findings if not f.annotations)
    return total, unreviewed


@consultant_router.get("/engagements", response_model=list[EngagementOut])
def list_engagements(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List assessments visible to the current user as a consultant or
    Garabyte admin. Other roles see an empty list (use /tenants for the
    customer-side dashboard instead).

    Each row carries the bits the consultant home needs to triage:
    score, completed-at, published-at, and finding counts. Sorted so
    "needs the most attention" lands at the top: newest unpublished
    submissions first, then in-progress, then published last.
    """
    is_garabyte_admin = any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships)
    if is_garabyte_admin:
        # Garabyte admin sees every tenant's assessments (R&P C4 elevation;
        # the /membership.check log captures the access).
        rows = (
            db.query(Assessment, Tenant)
            .join(Tenant, Tenant.id == Assessment.tenant_id)
            .order_by(
                Assessment.completed_at.desc().nullslast(),
                Assessment.started_at.desc(),
            )
            .all()
        )
    else:
        consultant_org_ids = [
            m.org_id for m in user.memberships if m.role == ROLE_CONSULTANT
        ]
        if not consultant_org_ids:
            return []
        rows = (
            db.query(Assessment, Tenant)
            .join(Tenant, Tenant.id == Assessment.tenant_id)
            .filter(Assessment.tenant_id.in_(consultant_org_ids))
            .order_by(
                Assessment.completed_at.desc().nullslast(),
                Assessment.started_at.desc(),
            )
            .all()
        )

    log_access(db, user_id=user.id, action="consultant.engagements.list",
               context={"count": len(rows), "garabyte_admin": is_garabyte_admin},
               ip=_ip(request))
    db.commit()

    out: list[EngagementOut] = []
    for a, t in rows:
        total, unreviewed = _engagement_counts(db, a.id)
        out.append(EngagementOut(
            tenant_id=t.id,
            tenant_slug=t.slug,
            tenant_name=t.name,
            tenant_sector=t.sector,
            tenant_jurisdiction=t.jurisdiction,
            tenant_employee_count=t.employee_count,
            assessment_id=a.id,
            assessment_label=a.label,
            assessment_status=a.status,
            overall_score=a.overall_score,
            started_at=a.started_at,
            completed_at=a.completed_at,
            published_at=a.published_at,
            findings_total=total,
            findings_unreviewed=unreviewed,
        ))
    return out


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


def _latest_annotation(finding: Finding) -> FindingAnnotation | None:
    """Latest-by-created_at annotation, or None. Append-only history;
    we just need the freshest row to compute the effective view."""
    if not finding.annotations:
        return None
    # The relationship is ordered by created_at ascending; the last one is
    # the most recent. (See models/finding.py)
    return finding.annotations[-1]


def _merge_finding(finding: Finding) -> dict:
    """
    Apply the latest annotation on top of the engine's row to produce the
    effective fields the customer would see, while preserving the engine's
    original values so consultants can render a diff. Returns a dict ready
    to instantiate a FindingOut from.
    """
    ann = _latest_annotation(finding)

    # Engine layer (always returned)
    base = {
        "id": finding.id,
        "assessment_id": finding.assessment_id,
        "dimension_id": finding.dimension_id,
        "finding_template_id": finding.finding_template_id,
        "engine_severity": finding.severity,
        "engine_finding_text": finding.finding_text,
        "engine_recommendation": finding.recommendation,
        "engine_regulatory_risk": finding.regulatory_risk,
        "engine_hours": finding.typical_consulting_hours,
        "source": finding.source,
        "score": finding.score,
        "upsell_hook": finding.upsell_hook,
    }

    # Effective fields default to engine values; overrides applied below
    eff = {
        "severity": finding.severity,
        "finding_text": finding.finding_text,
        "recommendation": finding.recommendation,
        "regulatory_risk": finding.regulatory_risk,
        "typical_consulting_hours": finding.typical_consulting_hours,
    }

    if ann is None:
        base.update(eff)
        base.update({
            "annotation_status": "unreviewed",
            "annotation_rationale": None,
            "annotation_consultant_id": None,
            "annotation_at": None,
        })
        return base

    # Apply annotation
    if ann.status == ANNOTATION_SEVERITY_ADJUSTED:
        if ann.new_severity:
            eff["severity"] = ann.new_severity
    elif ann.status == ANNOTATION_REPLACED:
        if ann.new_severity:
            eff["severity"] = ann.new_severity
        if ann.new_finding_text:
            eff["finding_text"] = ann.new_finding_text
        if ann.new_recommendation is not None:
            eff["recommendation"] = ann.new_recommendation
        if ann.new_regulatory_risk is not None:
            eff["regulatory_risk"] = ann.new_regulatory_risk
        if ann.new_hours is not None:
            eff["typical_consulting_hours"] = ann.new_hours
    # confirmed: effective == engine, no overrides
    # dismissed: effective == engine but UI filters; included for audit

    base.update(eff)
    base.update({
        "annotation_status": ann.status,
        "annotation_rationale": ann.rationale,
        "annotation_consultant_id": ann.consultant_id,
        "annotation_at": ann.created_at,
    })
    return base


def _finding_template_id(dimension_id: str, severity: str, finding_text: str) -> str:
    """
    Stable identifier for the same logical finding across re-scorings or
    rules-library edits. Used by Phase 5's gap-resolution logic so a
    finding that fired last quarter and didn't fire this quarter can be
    matched by template_id and rendered as "resolved." Truncated sha256
    is enough collision-resistance at scale.
    """
    h = hashlib.sha256(f"{dimension_id}|{severity}|{finding_text}".encode("utf-8"))
    return h.hexdigest()[:12]


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


@assessments_router.delete("/{assessment_id}", status_code=204)
def delete_assessment(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DSAR fulfillment, narrower scope — delete one assessment and everything
    that hangs off it (responses, findings, annotations, publication).
    Use this when a customer wants to drop a single preliminary draft
    without removing the org entirely (audit H4).

    Authorization: garabyte_admin (any membership) or org_admin of the
    owning tenant. Org admin can only delete their own org's assessments;
    cross-org deletion is admin-only.

    Cascade: Assessment.* relationships are configured with
    cascade="all, delete-orphan" plus FK ondelete=CASCADE on the dependent
    rows. AccessLog rows survive (resource_id will dangle once the
    assessment is gone — that's intentional for audit defensibility).
    """
    a = _load_assessment_or_404(db, assessment_id)

    is_garabyte_admin = any(m.role == ROLE_GARABYTE_ADMIN for m in user.memberships)
    if not is_garabyte_admin:
        # Non-admins must be an org_admin of this tenant.
        ensure_membership(
            db, user, a.tenant_id,
            roles=(ROLE_ORG_ADMIN,),
            request=request,
            action="assessment.delete.check",
        )

    snapshot = {
        "tenant_id": a.tenant_id,
        "label": a.label,
        "status": a.status,
        "overall_score": a.overall_score,
        "published": a.published_at is not None,
    }
    log_access(
        db, user_id=user.id, org_id=a.tenant_id, action="assessment.delete",
        resource_kind="assessment", resource_id=a.id, ip=_ip(request),
        context=snapshot,
    )
    db.delete(a)
    db.commit()


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

    Section contributors (R&P C5) may only write to questions belonging to
    dimensions explicitly listed in their membership.dimension_ids; the
    submit fails fast on the first out-of-scope question rather than
    silently dropping rows.
    """
    # Lazy import to avoid circular with main.py
    from ..main import RULES

    assessment = _load_assessment_or_404(db, assessment_id)
    if assessment.status == "completed":
        raise HTTPException(400, "Assessment is already completed")

    membership = ensure_membership(
        db, user, assessment.tenant_id,
        roles=_ASSESSMENT_WRITE_ROLES,
        request=request,
        action="assessment.write.check",
    )

    # Build a question_id -> dimension_id map for C5 scoping.
    qid_to_dim = {q.id: d.id for d in RULES.dimensions for q in d.questions}
    allowed_dims = (
        set(membership.dimension_ids or [])
        if membership.role == ROLE_SECTION_CONTRIBUTOR
        else None
    )

    known_qids = set(qid_to_dim.keys())
    created, updated = 0, 0

    for r in payload.responses:
        if r.question_id not in known_qids:
            raise HTTPException(400, f"Unknown question ID: {r.question_id}")

        # R&P C5 scoping: section contributors are confined to their
        # assigned dimensions. Org admins / consultants / garabyte admins
        # have allowed_dims == None and bypass the check.
        if allowed_dims is not None:
            dim = qid_to_dim[r.question_id]
            if dim not in allowed_dims:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"You aren't assigned to dimension {dim}; "
                        f"ask the org admin to add it to your section assignments."
                    ),
                )

        existing = db.query(Response).filter(
            Response.assessment_id == assessment_id,
            Response.question_id == r.question_id,
        ).first()

        if existing:
            existing.value = r.value
            existing.skipped = r.skipped
            existing.skip_reason = r.skip_reason
            existing.note = r.note
            existing.evidence_url = r.evidence_url
            existing.answered_at = datetime.utcnow()
            existing.answered_by_id = user.id
            updated += 1
        else:
            db.add(Response(
                assessment_id=assessment_id,
                question_id=r.question_id,
                value=r.value,
                skipped=r.skipped,
                skip_reason=r.skip_reason,
                note=r.note,
                evidence_url=r.evidence_url,
                answered_by_id=user.id,
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

    # Skipped or value-less rows are excluded from scoring -- they signal
    # "no data" the same way a missing row does (audit M21).
    responses = {
        r.question_id: r.value
        for r in assessment.responses
        if r.value is not None and not r.skipped
    }
    if not responses:
        raise HTTPException(400, "No responses submitted yet")

    evidence_provided = {
        r.question_id: bool(r.evidence_url)
        for r in assessment.responses
        if r.value is not None and not r.skipped
    }
    result = score_assessment(RULES, responses, evidence_provided)
    result_dict = result.to_dict()

    assessment.overall_score = result.overall_score
    assessment.overall_maturity = result.overall_maturity_label
    assessment.result_json = result_dict
    assessment.status = "completed"
    assessment.completed_at = datetime.utcnow()

    # Persist Finding rows for the consultant override layer (Phase 5).
    # The result_json blob stays as a frozen snapshot for reproducibility;
    # Finding rows are the editable source of truth from this point on.
    # First-finalize only (the early-return above handles re-finalize).
    for gap in result.gaps:
        db.add(Finding(
            assessment_id=assessment.id,
            dimension_id=gap.dimension_id,
            finding_template_id=_finding_template_id(
                gap.dimension_id, gap.severity, gap.finding,
            ),
            severity=gap.severity,
            finding_text=gap.finding,
            recommendation=gap.recommendation,
            regulatory_risk=gap.regulatory_risk,
            typical_consulting_hours=gap.typical_consulting_hours,
            upsell_hook=gap.upsell_hook,
            source=FINDING_SOURCE_ENGINE,
            score=gap.score,
        ))
    log_access(db, user_id=user.id, org_id=assessment.tenant_id,
               action="assessment.score",
               resource_kind="assessment", resource_id=assessment.id,
               context={"overall": result.overall_score}, ip=_ip(request))
    db.commit()
    db.refresh(assessment)

    return AssessmentResultOut(assessment=assessment, result=result_dict)


@assessments_router.get(
    "/{assessment_id}/responses",
    response_model=list[ResponseOut],
)
def list_responses(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return every persisted response for the assessment. The Resume
    Dashboard uses this to compute per-dimension progress (answered /
    skipped / untouched) and the Question Screen uses it to preload
    existing answers when the user resumes mid-flow.

    Same membership requirement as reading the assessment itself.
    """
    a = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_ASSESSMENT_READ_ROLES,
        request=request,
        action="assessment.responses.read.check",
    )
    log_access(db, user_id=user.id, org_id=a.tenant_id,
               action="assessment.responses.read",
               resource_kind="assessment", resource_id=a.id, ip=_ip(request))
    db.commit()

    # Hydrate answered_by_email in a single batched query (avoids N+1
    # while keeping ResponseOut a flat object the frontend can render
    # directly).
    answerer_ids = {r.answered_by_id for r in a.responses if r.answered_by_id}
    emails = (
        {u.id: u.email for u in db.query(User).filter(User.id.in_(answerer_ids)).all()}
        if answerer_ids else {}
    )
    return [
        ResponseOut(
            id=r.id,
            question_id=r.question_id,
            value=r.value,
            skipped=r.skipped,
            skip_reason=r.skip_reason,
            note=r.note,
            evidence_url=r.evidence_url,
            answered_at=r.answered_at,
            answered_by_id=r.answered_by_id,
            answered_by_email=emails.get(r.answered_by_id),
        )
        for r in a.responses
    ]


@assessments_router.get(
    "/{assessment_id}/findings",
    response_model=list[FindingOut],
)
def list_findings(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return findings for the assessment, with the latest annotation per
    finding merged into the effective fields. The engine's original
    values are preserved as engine_* so the consultant console can render
    a side-by-side diff.

    Customer-side renders (org_admin, org_viewer) should use only the
    effective fields and filter `annotation_status == 'dismissed'`.
    Consultant-side renders (consultant role) use everything.

    Same membership requirement as reading the assessment result.
    """
    a = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_ASSESSMENT_READ_ROLES,
        request=request,
        action="assessment.findings.read.check",
    )
    findings = (
        db.query(Finding)
        .filter(Finding.assessment_id == assessment_id)
        .order_by(Finding.id.asc())
        .all()
    )
    log_access(db, user_id=user.id, org_id=a.tenant_id,
               action="assessment.findings.read",
               resource_kind="assessment", resource_id=a.id,
               context={"count": len(findings)}, ip=_ip(request))
    db.commit()
    return [FindingOut(**_merge_finding(f)) for f in findings]


@assessments_router.post(
    "/{assessment_id}/findings",
    response_model=FindingOut,
    status_code=201,
)
def create_custom_finding(
    assessment_id: int,
    payload: CustomFindingCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Consultant adds a finding the engine missed. Source = consultant.
    Blocked once the assessment is published (R&P C14).
    """
    a = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_FINDING_EDIT_ROLES,
        request=request,
        action="finding.create.check",
    )
    if db.query(AssessmentPublication).filter(
        AssessmentPublication.assessment_id == assessment_id,
    ).first():
        raise HTTPException(
            status_code=423,
            detail="Assessment is already published; create a new version to add findings",
        )

    finding = Finding(
        assessment_id=assessment_id,
        dimension_id=payload.dimension_id,
        finding_template_id=_finding_template_id(
            payload.dimension_id, payload.severity, payload.finding_text,
        ),
        severity=payload.severity,
        finding_text=payload.finding_text,
        recommendation=payload.recommendation,
        regulatory_risk=payload.regulatory_risk,
        typical_consulting_hours=payload.typical_consulting_hours,
        source=FINDING_SOURCE_CONSULTANT,
    )
    db.add(finding)
    db.flush()
    log_access(db, user_id=user.id, org_id=a.tenant_id,
               action="finding.create",
               resource_kind="finding", resource_id=finding.id,
               context={"dimension": payload.dimension_id, "severity": payload.severity},
               ip=_ip(request))
    db.commit()
    db.refresh(finding)
    return FindingOut(**_merge_finding(finding))


@assessments_router.post(
    "/{assessment_id}/publish",
    response_model=PublicationOut,
    status_code=201,
)
def publish_assessment(
    assessment_id: int,
    payload: PublishCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Consultant publishes the report to the customer. Locks further
    annotation edits per R&P C14.

    Three cases:
      - First publish: creates a new pub row at version 1.
      - Re-publish after unpublish: clears unpublished_at, bumps version,
        refreshes published_at, replaces cover_note with the latest, and
        revokes any outstanding share links bound to this assessment so
        old recipients aren't shown new content (R&P C21).
      - Already published with no in-flight unpublish: idempotent — returns
        the existing row unchanged.
    """
    a = _load_assessment_or_404(db, assessment_id)
    if a.status != "completed":
        raise HTTPException(400, "Assessment must be scored before publication")
    ensure_membership(
        db, user, a.tenant_id,
        roles=_FINDING_EDIT_ROLES,
        request=request,
        action="assessment.publish.check",
    )
    existing = (
        db.query(AssessmentPublication)
        .filter(AssessmentPublication.assessment_id == assessment_id)
        .first()
    )
    if existing and existing.unpublished_at is None:
        return existing

    if existing:
        # Republish path — bump version, revoke old share links.
        existing.version = (existing.version or 1) + 1
        existing.unpublished_at = None
        existing.published_at = datetime.utcnow()
        existing.published_by_id = user.id
        existing.cover_note = payload.cover_note
        revoked = _revoke_share_links_for(db, assessment_id)
        log_access(db, user_id=user.id, org_id=a.tenant_id,
                   action="assessment.republish",
                   resource_kind="assessment", resource_id=a.id,
                   context={"version": existing.version, "revoked_links": revoked},
                   ip=_ip(request))
        db.commit()
        db.refresh(existing)
        return existing

    pub = AssessmentPublication(
        assessment_id=assessment_id,
        published_by_id=user.id,
        cover_note=payload.cover_note,
        version=1,
    )
    db.add(pub)
    db.flush()
    log_access(db, user_id=user.id, org_id=a.tenant_id,
               action="assessment.publish",
               resource_kind="assessment", resource_id=a.id,
               context={"version": 1},
               ip=_ip(request))
    db.commit()
    db.refresh(pub)
    return pub


@assessments_router.post(
    "/{assessment_id}/unpublish",
    response_model=PublicationOut,
)
def unpublish_assessment(
    assessment_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reopen the edit window so a consultant can revise the report. The pub
    row stays for version continuity; the next publish bumps version and
    revokes outstanding share links.

    Already-unpublished is idempotent. The customer's view of the report
    while unpublished is "previous version, awaiting revision" — the
    frontend renders the existing row with the unpublished_at flag.
    """
    a = _load_assessment_or_404(db, assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_FINDING_EDIT_ROLES,
        request=request,
        action="assessment.unpublish.check",
    )
    pub = (
        db.query(AssessmentPublication)
        .filter(AssessmentPublication.assessment_id == assessment_id)
        .first()
    )
    if not pub:
        raise HTTPException(400, "Assessment was never published")

    if pub.unpublished_at is None:
        pub.unpublished_at = datetime.utcnow()
        log_access(db, user_id=user.id, org_id=a.tenant_id,
                   action="assessment.unpublish",
                   resource_kind="assessment", resource_id=a.id,
                   context={"version": pub.version},
                   ip=_ip(request))
        db.commit()
    db.refresh(pub)
    return pub


def _revoke_share_links_for(db: Session, assessment_id: int) -> int:
    """
    Revoke every active share link for an assessment. Returns count
    revoked (so the caller can log it). Used on republish so old recipients
    don't silently see new content (R&P C21 + the ShareLink model docstring).
    """
    from ..models import ShareLink  # local import to avoid circular
    now = datetime.utcnow()
    rows = (
        db.query(ShareLink)
        .filter(
            ShareLink.assessment_id == assessment_id,
            ShareLink.revoked_at.is_(None),
            ShareLink.expires_at > now,
        )
        .all()
    )
    for r in rows:
        r.revoked_at = now
    return len(rows)


@findings_router.post(
    "/{finding_id}/annotations",
    response_model=AnnotationOut,
    status_code=201,
)
def create_annotation(
    finding_id: int,
    payload: AnnotationCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Consultant edits a finding (R&P C13). Blocked once the assessment is
    published (R&P C14). Append-only: the latest annotation is the
    authoritative override; earlier ones stay in the audit trail.
    """
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(404, "Finding not found")

    a = _load_assessment_or_404(db, finding.assessment_id)
    ensure_membership(
        db, user, a.tenant_id,
        roles=_FINDING_EDIT_ROLES,
        request=request,
        action="finding.annotate.check",
    )
    pub = (
        db.query(AssessmentPublication)
        .filter(AssessmentPublication.assessment_id == finding.assessment_id)
        .first()
    )
    if pub and pub.unpublished_at is None:
        # Locked while published. Consultant can call /unpublish to reopen
        # the edit window for a new version (Phase 8).
        raise HTTPException(
            status_code=423,
            detail="Assessment is published; unpublish first to start a new version",
        )

    ann = FindingAnnotation(
        finding_id=finding_id,
        consultant_id=user.id,
        status=payload.status,
        new_severity=payload.new_severity,
        new_finding_text=payload.new_finding_text,
        new_recommendation=payload.new_recommendation,
        new_regulatory_risk=payload.new_regulatory_risk,
        new_hours=payload.new_hours,
        rationale=payload.rationale,
    )
    db.add(ann)
    db.flush()
    log_access(db, user_id=user.id, org_id=a.tenant_id,
               action="finding.annotate",
               resource_kind="finding", resource_id=finding_id,
               context={"status": payload.status}, ip=_ip(request))
    db.commit()
    db.refresh(ann)
    return ann


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
