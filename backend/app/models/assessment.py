"""Assessment model -- a single run-through of the questionnaire."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from .base import Base


class Assessment(Base):
    """
    A single run of the questionnaire for a tenant. Tenants can have many
    assessments over time -- quarterly reassessments build history.

    Assessments are append-only -- we never edit old scores. The result_json
    field stores a snapshot of the full scored output so we don't recompute
    when viewing the dashboard.
    """
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    label = Column(String(255), nullable=True)  # e.g. "Q1 2026 Review"
    status = Column(String(32), default="in_progress")  # in_progress | completed
    overall_score = Column(Float, nullable=True)
    overall_maturity = Column(String(32), nullable=True)
    result_json = Column(JSON, nullable=True)  # full AssessmentResult snapshot
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="assessments")
    responses = relationship(
        "Response",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    @property
    def published_at(self):
        """
        Convenience accessor used by AssessmentOut.from_attributes so the
        customer-facing dashboard can show "Awaiting consultant review"
        between completion and publication (R&P C13/C14, Phase 5).

        publication backref is defined on AssessmentPublication.assessment.
        """
        pub = getattr(self, "publication", None)
        return pub.published_at if pub else None

    def __repr__(self) -> str:
        return (
            f"<Assessment id={self.id} tenant_id={self.tenant_id} "
            f"status={self.status} score={self.overall_score}>"
        )
