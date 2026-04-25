"""
Email sender — stub for now.

Phase 3 only needs the contract; real SMTP wiring is a separate concern.
The stub prints to stdout in dev so a developer can copy-paste verification
links from the terminal.

When real email lands, replace `send_email` with an SMTP / SendGrid / SES
implementation. Callers won't need to change.
"""

from __future__ import annotations

import logging

from ..config import settings

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, body: str) -> None:
    """
    Send an email. In dev (app_env=development), just log to stdout so the
    developer can read tokens during local testing. In any other env, the
    current stub still logs but emits a WARNING — production deploys must
    swap this for a real sender before going live.
    """
    if settings.app_env == "development":
        logger.info(
            "\n--- DEV EMAIL ---\nTo: %s\nSubject: %s\n\n%s\n--- END EMAIL ---\n",
            to, subject, body,
        )
    else:
        # Don't silently no-op in non-dev. Make the missing-sender problem loud.
        logger.warning(
            "send_email called in env=%s but no real sender wired. "
            "Email to=%s subject=%r dropped.",
            settings.app_env, to, subject,
        )
