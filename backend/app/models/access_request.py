"""
Inbound access requests from the public landing page.

Anyone can POST to /access-requests anonymously; a row lands in this
table and surfaces in the garabyte_admin admin queue. Triage is manual
for v1 — Garabyte ops responds by email, then either creates a tenant +
issues an invitation (the existing flow) or marks the request as
declined.

No PII beyond what the requester voluntarily provided. Rate-limited at
the route layer to slow scrape spam.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .base import Base


# Status enum (kept narrow for v1 — extend as ops needs).
ACCESS_REQUEST_PENDING = "pending"
ACCESS_REQUEST_CONTACTED = "contacted"
ACCESS_REQUEST_ONBOARDED = "onboarded"
ACCESS_REQUEST_DECLINED = "declined"

ALL_ACCESS_REQUEST_STATUSES = (
    ACCESS_REQUEST_PENDING,
    ACCESS_REQUEST_CONTACTED,
    ACCESS_REQUEST_ONBOARDED,
    ACCESS_REQUEST_DECLINED,
)


class AccessRequest(Base):
    """
    A "Request access" form submission. Garabyte ops triages from the
    admin queue. Status transitions are manual (no automated emails);
    the audit log captures every change so the chain is defensible.
    """
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    org_name = Column(String(255), nullable=False)
    sector = Column(String(64), nullable=True)  # values from KNOWN_SECTORS
    employee_count = Column(Integer, nullable=True)
    message = Column(Text, nullable=True)  # free-text from the requester
    source_ip = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    status = Column(String(32), nullable=False, default=ACCESS_REQUEST_PENDING)
    # Free-text triage notes from the Garabyte admin. Surface only in the
    # admin queue, never to the requester.
    triage_notes = Column(Text, nullable=True)
    triaged_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    triaged_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    triaged_by = relationship("User")

    def __repr__(self) -> str:
        return (
            f"<AccessRequest id={self.id} email={self.email!r} "
            f"org={self.org_name!r} status={self.status}>"
        )
