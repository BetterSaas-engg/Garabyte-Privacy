"""
Email sender — env-driven backend.

EMAIL_BACKEND selects the transport:
  "stdout"  — print to uvicorn terminal (default; for local dev so links show
               up directly in the log without configuring an SMTP server).
  "smtp"    — open an SMTP/STARTTLS connection per call. Slow but simple,
               appropriate for the Phase 7 launch volume (verification +
               magic links + invitations + password resets — order of
               magnitude tens per day, not transactional fanout).

Anything else raises at first send_email() call so a typo'd config doesn't
silently degrade to "links never delivered."

Future hardening: connection pooling, async sending via a worker queue,
provider integration (SES / SendGrid / Postmark). Intentionally out of
scope for v1 — the contract here stays the same regardless of transport.
"""

from __future__ import annotations

import logging
import smtplib
import sys
from email.message import EmailMessage

from ..config import settings

logger = logging.getLogger(__name__)


def _send_stdout(*, to: str, subject: str, body: str) -> None:
    """Print to stdout so dev sees the link in the uvicorn terminal."""
    print(
        f"\n--- DEV EMAIL ---\nTo: {to}\nSubject: {subject}\n\n{body}\n--- END EMAIL ---\n",
        file=sys.stdout,
        flush=True,
    )


def _send_smtp(*, to: str, subject: str, body: str) -> None:
    """Send via SMTP with STARTTLS by default. Raises on any transport error."""
    if not settings.smtp_host:
        raise RuntimeError(
            "EMAIL_BACKEND=smtp but SMTP_HOST is empty. Set smtp_host/port/user/password."
        )

    msg = EmailMessage()
    msg["From"] = settings.email_from
    msg["To"] = to
    msg["Subject"] = subject
    if settings.email_reply_to:
        msg["Reply-To"] = settings.email_reply_to
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.ehlo()
        if settings.smtp_use_starttls:
            smtp.starttls()
            smtp.ehlo()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def send_email(*, to: str, subject: str, body: str) -> None:
    """
    Send an email. The actual transport is determined by EMAIL_BACKEND.

    Failures in the SMTP path raise — the caller (auth flows) should surface
    a generic "we couldn't send your email, try again" rather than swallowing
    the error silently. A dropped magic link is worse than a 500.
    """
    backend = settings.email_backend
    if backend == "stdout":
        _send_stdout(to=to, subject=subject, body=body)
        return
    if backend == "smtp":
        try:
            _send_smtp(to=to, subject=subject, body=body)
            logger.info("email.sent backend=smtp to=%s subject=%r", to, subject)
        except Exception:
            logger.exception("email.failed backend=smtp to=%s subject=%r", to, subject)
            raise
        return
    raise RuntimeError(
        f"Unknown EMAIL_BACKEND={backend!r}. Expected 'stdout' or 'smtp'."
    )
