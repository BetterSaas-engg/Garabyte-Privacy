"""
Evidence file model — uploaded artifact backing a Response.

Phase 10 of the audit follows H9: the customer can hand a consultant a
URL to existing storage *or* upload a file directly into Garabyte's
storage. Both paths converge on Response.evidence_url; for direct
uploads we store /evidence/{file_id} so the API can stream + audit-log
each access.

Storage backend is pluggable. Default is local-disk under
EVIDENCE_STORAGE_DIR (env var; defaults to backend/evidence_files/).
Production should swap this for object storage — the EvidenceStorage
abstraction in services/evidence_storage.py is the seam.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .base import Base


class EvidenceFile(Base):
    """
    One uploaded evidence file, attached to a single Response.

    Hard caps enforced at the upload endpoint, NOT at the model layer
    (so legacy data can be migrated without size validation). Uploads
    are bound to (assessment_id, response_id) so a tenant deletion
    cascades through Response → EvidenceFile, and the storage layer can
    list-and-purge after the row goes.
    """
    __tablename__ = "evidence_files"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(
        Integer,
        ForeignKey("responses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(128), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    # Opaque path the storage backend hands back. For local-disk that's
    # a UUID-named file under EVIDENCE_STORAGE_DIR. For S3-and-similar
    # it'd be the object key. Never trust this string from user input.
    storage_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    response = relationship("Response")

    def __repr__(self) -> str:
        return f"<EvidenceFile id={self.id} response_id={self.response_id} {self.original_filename!r}>"
