"""
Email sender — stub for now.

Phase 3 only needs the contract; real SMTP wiring is a separate concern.
The stub prints to stdout in dev so a developer can copy-paste verification
links straight from the uvicorn terminal.

When real email lands, replace `send_email` with an SMTP / SendGrid / SES
implementation. Callers won't need to change.
"""

from __future__ import annotations

import logging
import sys

from ..config import settings

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, body: str) -> None:
    """
    Send an email. In dev (app_env=development), print to stdout with
    flush=True so the link shows up immediately in the uvicorn terminal.
    (We use print, not logger.info, because uvicorn doesn't configure
    arbitrary app loggers by default — logger.info messages get dropped.)
    In any other env, log a WARNING so a missing-sender problem is loud.
    """
    if settings.app_env == "development":
        print(
            f"\n--- DEV EMAIL ---\nTo: {to}\nSubject: {subject}\n\n{body}\n--- END EMAIL ---\n",
            file=sys.stdout,
            flush=True,
        )
    else:
        logger.warning(
            "send_email called in env=%s but no real sender wired. "
            "Email to=%s subject=%r dropped.",
            settings.app_env, to, subject,
        )
