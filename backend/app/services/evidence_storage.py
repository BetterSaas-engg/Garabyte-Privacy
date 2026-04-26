"""
Evidence-file storage abstraction.

The local-disk implementation is the only one wired today; the abstraction
is here so production can swap to S3 / GCS / R2 without touching route
code. The interface deliberately mirrors blob-store primitives:

    put(stream, ext) -> opaque_path
    open(opaque_path) -> file-like
    delete(opaque_path) -> None

opaque_path is whatever the backend hands back at put time. For local-disk
that's a UUID-named file under the configured storage dir. Never construct
or interpret that string from user input.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import BinaryIO

from ..config import settings


class EvidenceStorage:
    """Local-disk backed evidence store."""

    def __init__(self, base_dir: str | None = None) -> None:
        self.base_dir = Path(base_dir or settings.evidence_storage_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def put(self, source: BinaryIO, ext: str) -> str:
        """
        Stream `source` into a UUID-named file. Returns the relative path
        we store in the DB (the file id, not the absolute path).

        Caller is responsible for size validation BEFORE calling — this
        method writes everything it's given.
        """
        # Sanitize extension: strip leading dot, lowercase, drop anything
        # that's not [a-z0-9]. Bounded to 8 chars.
        clean_ext = "".join(c for c in ext.lstrip(".").lower() if c.isalnum())[:8]
        fname = f"{uuid.uuid4().hex}{('.' + clean_ext) if clean_ext else ''}"
        full = self.base_dir / fname
        with open(full, "wb") as out:
            while True:
                chunk = source.read(64 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        return fname

    def open(self, opaque_path: str) -> BinaryIO:
        """Open a stored file for reading. Raises FileNotFoundError if gone."""
        full = self._resolve(opaque_path)
        return open(full, "rb")

    def delete(self, opaque_path: str) -> None:
        """Remove a stored file. Best-effort — silent if already gone."""
        full = self._resolve(opaque_path)
        try:
            os.remove(full)
        except FileNotFoundError:
            pass

    def _resolve(self, opaque_path: str) -> Path:
        """
        Map the stored path back to a real file, refusing path traversal.
        opaque_path must be a bare filename produced by put() — no slashes,
        no '..'. Anything else raises ValueError.
        """
        if "/" in opaque_path or "\\" in opaque_path or ".." in opaque_path:
            raise ValueError(f"Invalid storage path: {opaque_path!r}")
        return self.base_dir / opaque_path


# Module-level singleton; routes import this directly.
storage = EvidenceStorage()
