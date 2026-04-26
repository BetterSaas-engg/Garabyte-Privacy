"""Response model -- one question answer within an assessment."""

from datetime import datetime

from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Response(Base):
    """
    A single question response. Forty of these make up one completed
    assessment. question_id matches a question from the rules library
    (e.g. "d1_q1").

    A row can be in one of two states:
      - answered: value is in [0..4], skipped is False
      - explicitly skipped: value is None, skipped is True (audit M21)
    Untouched questions have no row at all. The Resume Dashboard
    distinguishes "skipped" from "not started"; the scoring engine
    treats both the same (excluded from the dimension's weighted mean).
    """
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(
        Integer, ForeignKey("assessments.id"), nullable=False, index=True
    )
    question_id = Column(String(32), nullable=False)
    # Nullable: a skipped row carries no value. Application-layer validation
    # ensures (value is not None) XOR (skipped is True) -- see ResponseSubmit.
    value = Column(Integer, nullable=True)
    skipped = Column(Boolean, nullable=False, default=False)
    skip_reason = Column(String(32), nullable=True)
    evidence_url = Column(String(512), nullable=True)
    note = Column(Text, nullable=True)
    answered_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("Assessment", back_populates="responses")

    def __repr__(self) -> str:
        state = "skipped" if self.skipped else f"v={self.value}"
        return (
            f"<Response assessment_id={self.assessment_id} "
            f"q={self.question_id} {state}>"
        )
