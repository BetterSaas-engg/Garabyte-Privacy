"""
Notification helpers — fan-out emails on key lifecycle events.

Today: assessment scored → consultants notified; assessment published →
org admins + viewers notified. Failures during fan-out are logged and
swallowed (we'd rather complete the score/publish action than 500 the
customer because Postmark hiccuped). Each send is audit-logged with
action `notify.<event>` so a regulator can verify the chain triggered.

Email transport itself is stub'd in dev (prints to uvicorn stdout) and
SMTP-backed in production — see app/auth/email.py and EMAIL_BACKEND.
"""

from __future__ import annotations

import logging
from typing import Iterable

from sqlalchemy.orm import Session

from ..auth.email import send_email
from ..auth.service import log_access
from ..config import settings
from ..models import (
    Assessment,
    OrgMembership,
    ROLE_CONSULTANT,
    ROLE_GARABYTE_ADMIN,
    ROLE_ORG_ADMIN,
    ROLE_ORG_VIEWER,
    Tenant,
    User,
)


logger = logging.getLogger(__name__)


def _recipients_for_roles(
    db: Session, tenant_id: int, roles: Iterable[str],
) -> list[User]:
    """All users with one of `roles` on `tenant_id`. Deduplicated."""
    return (
        db.query(User)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .filter(
            OrgMembership.org_id == tenant_id,
            OrgMembership.role.in_(tuple(roles)),
        )
        .distinct()
        .all()
    )


def _safe_send(*, to: str, subject: str, body: str) -> bool:
    """Send and swallow exceptions. Returns True on success."""
    try:
        send_email(to=to, subject=subject, body=body)
        return True
    except Exception:
        logger.exception("notify.send_failed to=%s subject=%r", to, subject)
        return False


def notify_assessment_scored(
    db: Session,
    *,
    assessment: Assessment,
    tenant: Tenant,
    submitter_id: int,
) -> None:
    """
    Customer just submitted an assessment for scoring. Fan out to every
    consultant assigned to this tenant. Caller commits the audit-log row.
    """
    consultants = _recipients_for_roles(db, tenant.id, [ROLE_CONSULTANT])
    if not consultants:
        # No consultant assigned — log it so a Garabyte admin can react.
        log_access(
            db, user_id=submitter_id, org_id=tenant.id,
            action="notify.scored.no_consultant",
            resource_kind="assessment", resource_id=assessment.id,
            context={"tenant_slug": tenant.slug},
        )
        return

    review_url = f"{settings.frontend_base_url}/consultant/{tenant.slug}/{assessment.id}/findings"
    subject = f"[Garabyte] {tenant.name} submitted an assessment"
    body = (
        f"Hi,\n\n"
        f"{tenant.name} just submitted an assessment for review.\n\n"
        f"Label: {assessment.label or '—'}\n"
        f"Overall score: {assessment.overall_score:.2f} / 4.00\n"
        f"Maturity: {assessment.overall_maturity or '—'}\n\n"
        f"Open the findings to review and publish:\n"
        f"  {review_url}\n\n"
        f"— Garabyte Privacy Health Check\n"
    )

    sent = 0
    for c in consultants:
        if _safe_send(to=c.email, subject=subject, body=body):
            sent += 1

    log_access(
        db, user_id=submitter_id, org_id=tenant.id,
        action="notify.scored",
        resource_kind="assessment", resource_id=assessment.id,
        context={
            "consultants_total": len(consultants),
            "consultants_sent": sent,
        },
    )


def notify_assessment_published(
    db: Session,
    *,
    assessment: Assessment,
    tenant: Tenant,
    publisher_id: int,
    cover_note: str | None,
) -> None:
    """
    Consultant just published the report. Fan out to org admins +
    viewers (the customer-side stakeholders). Caller commits.
    """
    recipients = _recipients_for_roles(
        db, tenant.id, [ROLE_ORG_ADMIN, ROLE_ORG_VIEWER],
    )
    if not recipients:
        log_access(
            db, user_id=publisher_id, org_id=tenant.id,
            action="notify.published.no_recipients",
            resource_kind="assessment", resource_id=assessment.id,
        )
        return

    report_url = f"{settings.frontend_base_url}/tenants/{tenant.slug}"
    subject = f"[Garabyte] Your privacy report for {tenant.name} is ready"
    note_block = f"\n\nFrom your consultant:\n  {cover_note}\n" if cover_note else ""
    body = (
        f"Hi,\n\n"
        f"Your Garabyte Privacy Health Check report for {tenant.name} has been"
        f" published. The consultant has reviewed every finding."
        f"{note_block}\n\n"
        f"View the report:\n"
        f"  {report_url}\n\n"
        f"— Garabyte Privacy Health Check\n"
    )

    sent = 0
    for u in recipients:
        if _safe_send(to=u.email, subject=subject, body=body):
            sent += 1

    log_access(
        db, user_id=publisher_id, org_id=tenant.id,
        action="notify.published",
        resource_kind="assessment", resource_id=assessment.id,
        context={
            "recipients_total": len(recipients),
            "recipients_sent": sent,
        },
    )
