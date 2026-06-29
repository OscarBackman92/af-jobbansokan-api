"""Shared helpers for outbound e-mail configuration."""

from __future__ import annotations

import os


def email_is_configured() -> bool:
    """True when a production mail backend is configured (API or SMTP)."""
    return bool(os.getenv("BREVO_API_KEY") or os.getenv("EMAIL_HOST"))
