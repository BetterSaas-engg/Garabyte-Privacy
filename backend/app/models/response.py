"""Response model -- one question answer within an assessment."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Response(Base):
    """
    A single question response. Forty of these make up one completed
    assessment. question_id matches a question from the rules library
    (e.g. "d1_q1").
    """
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(
        Integer, ForeignKey("assessments.id"), nullable=False, index=True
    )
    question_id = Column(String(32), nullable=False)
    value = Column(Integer, nullable=False)  # 0-4 score
    evidence_url = Column(String(512), nullable=True)
    note = Column(Text, nullable=True)
    answered_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("Assessment", back_populates="responses")

    def __repr__(self) -> str:
        return (
            f"<Response assessment_id={self.assessment_id} "
            f"q={self.question_id} v={self.value}>"
        )
