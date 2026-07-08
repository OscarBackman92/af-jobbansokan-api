"""Resolve the public app URL for e-mail links and django.contrib.sites."""

from __future__ import annotations

import os
from urllib.parse import urlparse

# Previous Render hostname — still present in some manually copied cron env vars.
_LEGACY_FRONTEND_HOSTS = frozenset({"ansokt.onrender.com"})
_CANONICAL_PRODUCTION_URL = "https://jobbjungeln.onrender.com"


def resolve_frontend_url() -> str:
    """Return the canonical public origin (no trailing slash).

    Priority:
    1. Replace a legacy ansokt.onrender.com FRONTEND_URL everywhere (web + cron).
    2. Use Render's injected hostname when FRONTEND_URL is unset.
    3. Fall back to the explicit FRONTEND_URL env var.
    """
    explicit = os.getenv("FRONTEND_URL", "").strip()
    if explicit:
        host = urlparse(
            explicit if "://" in explicit else f"https://{explicit}"
        ).netloc.lower()
        if host in _LEGACY_FRONTEND_HOSTS:
            return _CANONICAL_PRODUCTION_URL
        return explicit.rstrip("/")

    render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
    if render_host:
        return f"https://{render_host}"

    return ""
