"""
Evidence file upload + download endpoints (Phase 10 / audit H9).

Surfaces:
  POST   /responses/{response_id}/evidence  — upload a file
  GET    /evidence/{evidence_id}            — stream + audit-log
  DELETE /evidence/{evidence_id}            — remove + clear pointer

The MIME allowlist is intentionally tight (PDF, common Office docs,
text, common image types). Anything else returns 415; we'd rather a
customer with a .heic file ping us than a stale safelist let through
something the consultant can't open. Server-side type validation uses
the upload's reported MIME type only — that's the same trust level as
the existing evidence_url path.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..auth.deps import ensure_membership, get_current_user
from ..auth.service import log_access
from ..config import settings
from ..database import get_db
from ..models import (
    Assessment,
    EvidenceFile,
    Response,
    ROLE_CONSULTANT,
    ROLE_GARABYTE_ADMIN,
    ROLE_ORG_ADMIN,
    ROLE_ORG_VIEWER,
    ROLE_SECTION_CONTRIBUTOR,
    User,
)
from ..services.evidence_storage import storage


router = APIRouter(tags=["evidence"])

# Roles allowed to read evidence (everyone in the org plus the consultant).
_EVIDENCE_READ_ROLES = (
    ROLE_ORG_ADMIN,
    ROLE_SECTION_CONTRIBUTOR,
    ROLE_ORG_VIEWER,
    ROLE_CONSULTANT,
)
# Roles allowed to upload + delete evidence (the people who answer
# questions, plus the org_admin who oversees them). Garabyte admins
# elevate via the implicit-bypass path.
_EVIDENCE_WRITE_ROLES = (ROLE_ORG_ADMIN, ROLE_SECTION_CONTRIBUTOR)


_ALLOWED_MIMES = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
    "text/csv": "csv",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
}


class EvidenceFileOut(BaseModel):
    id: int
    response_id: int
    original_filename: str
    mime_type: str
    size_bytes: int
    uploaded_at: datetime
    uploaded_by_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _evidence_url_for(file_id: int) -> str:
    """The string we write into Response.evidence_url for native uploads."""
    return f"/evidence/{file_id}"


@router.post(
    "/responses/{response_id}/evidence",
    response_model=EvidenceFileOut,
    status_code=201,
)
async def upload_evidence(
    response_id: int,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Attach an uploaded file to an existing Response. Caller must be a
    section contributor or org admin of the owning tenant. The Response
    must already exist — uploading evidence before answering the question
    isn't supported (the upload cuts off the "verified vs self-reported"
    framing of the question screen).

    On success, sets Response.evidence_url to /evidence/{id}; replaces any
    prior file (orphaned bytes are cleaned up).
    """
    r = db.query(Response).filter(Response.id == response_id).first()
    if not r:
        raise HTTPException(404, "Response not found")
    a = db.query(Assessment).filter(Assessment.id == r.assessment_id).first()
    if not a:
        raise HTTPException(404, "Underlying assessment not found")

    ensure_membership(
        db, user, a.tenant_id,
        roles=_EVIDENCE_WRITE_ROLES,
        request=request,
        action="evidence.upload.check",
    )

    # MIME allowlist
    mime = (file.content_type or "").lower()
    if mime not in _ALLOWED_MIMES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type {mime!r}. Accepted: PDF, Office docs, "
                "TXT/CSV, PNG/JPG/GIF/WebP."
            ),
        )
    ext = _ALLOWED_MIMES[mime]

    # Streaming size check — read into the storage backend in 64KB chunks
    # but bail at the cap. UploadFile is backed by a SpooledTemporaryFile
    # so we can read it twice if needed; we don't, but we do enforce the
    # size guard manually because UploadFile has no max_size.
    raw = await file.read()
    if len(raw) > settings.evidence_max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.evidence_max_bytes // (1024 * 1024)} MB cap",
        )

    # Write to storage (UUID-named) — original filename never reaches disk
    import io
    storage_path = storage.put(io.BytesIO(raw), ext)

    # Replace any prior upload for this response.
    prior = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.response_id == response_id)
        .first()
    )
    if prior:
        storage.delete(prior.storage_path)
        db.delete(prior)
        db.flush()

    ev = EvidenceFile(
        response_id=response_id,
        uploaded_by_id=user.id,
        original_filename=file.filename or "upload",
        mime_type=mime,
        size_bytes=len(raw),
        storage_path=storage_path,
    )
    db.add(ev)
    db.flush()

    r.evidence_url = _evidence_url_for(ev.id)

    log_access(
        db, user_id=user.id, org_id=a.tenant_id,
        action="evidence.upload",
        resource_kind="evidence_file", resource_id=ev.id, ip=_ip(request),
        context={
            "response_id": response_id,
            "size_bytes": len(raw),
            "mime": mime,
            "filename": (file.filename or "")[:120],
        },
    )
    db.commit()
    db.refresh(ev)
    return ev


@router.get("/evidence/{evidence_id}")
def download_evidence(
    evidence_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream a stored file. Each download is logged with the reader's
    user_id and IP — the watermark stub. Real file-content watermarking
    (overlaid PDF stamp, EXIF-stripped image with a footer) is a
    follow-up; the audit-log row is the regulatory-grade lever today.
    """
    ev = db.query(EvidenceFile).filter(EvidenceFile.id == evidence_id).first()
    if not ev:
        raise HTTPException(404, "Evidence file not found")
    r = db.query(Response).filter(Response.id == ev.response_id).first()
    if not r:
        raise HTTPException(404, "Underlying response not found")
    a = db.query(Assessment).filter(Assessment.id == r.assessment_id).first()
    if not a:
        raise HTTPException(404, "Underlying assessment not found")

    ensure_membership(
        db, user, a.tenant_id,
        roles=_EVIDENCE_READ_ROLES,
        request=request,
        action="evidence.read.check",
    )

    log_access(
        db, user_id=user.id, org_id=a.tenant_id,
        action="evidence.read",
        resource_kind="evidence_file", resource_id=ev.id, ip=_ip(request),
        context={"response_id": ev.response_id, "filename": ev.original_filename[:120]},
    )
    db.commit()

    try:
        fh = storage.open(ev.storage_path)
    except FileNotFoundError:
        raise HTTPException(410, "Evidence file no longer available")

    return StreamingResponse(
        fh,
        media_type=ev.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{ev.original_filename}"',
            # Watermark hint surfaces in the response so a downstream
            # PDF-stamp middleware can latch onto it later.
            "X-Garabyte-Watermark-Reader": str(user.id),
            "X-Garabyte-Watermark-At": datetime.utcnow().isoformat(timespec="seconds"),
        },
    )


@router.delete("/evidence/{evidence_id}", status_code=204)
def delete_evidence(
    evidence_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove an uploaded evidence file and clear Response.evidence_url.
    Same permissions as upload. Garabyte admins may also delete via
    the cross-tenant elevation path.
    """
    ev = db.query(EvidenceFile).filter(EvidenceFile.id == evidence_id).first()
    if not ev:
        raise HTTPException(404, "Evidence file not found")
    r = db.query(Response).filter(Response.id == ev.response_id).first()
    if not r:
        raise HTTPException(404, "Underlying response not found")
    a = db.query(Assessment).filter(Assessment.id == r.assessment_id).first()
    if not a:
        raise HTTPException(404, "Underlying assessment not found")

    ensure_membership(
        db, user, a.tenant_id,
        roles=_EVIDENCE_WRITE_ROLES,
        request=request,
        action="evidence.delete.check",
    )

    storage.delete(ev.storage_path)
    if r.evidence_url == _evidence_url_for(ev.id):
        r.evidence_url = None
    log_access(
        db, user_id=user.id, org_id=a.tenant_id,
        action="evidence.delete",
        resource_kind="evidence_file", resource_id=ev.id, ip=_ip(request),
    )
    db.delete(ev)
    db.commit()
