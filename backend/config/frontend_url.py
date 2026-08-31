"""Resolve the public app URL for e-mail links and django.contrib.sites."""

from __future__ import annotations

import os
from urllib.parse import urlparse

# Older hostnames that still linger in Render env copies and cron jobs.
_LEGACY_FRONTEND_HOSTS = frozenset(
    {
        "ansokt.onrender.com",
        "jobbjungeln.onrender.com",
    }
)
_CANONICAL_PRODUCTION_URL = "https://jobbdjungeln.obackman.se"


def _host(url: str) -> str:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return (parsed.netloc or parsed.path.split("/")[0]).lower()


def resolve_frontend_url() -> str:
    """Return the canonical public origin (no trailing slash).

    Priority:
    1. Rewrite legacy onrender FRONTEND_URL values (web + cron).
    2. Prefer the custom domain when Render injects the old hostname.
    3. Use an explicit non-legacy FRONTEND_URL.
    4. Fall back to Render's injected hostname for preview deploys.
    """
    explicit = os.getenv("FRONTEND_URL", "").strip()
    if explicit:
        if _host(explicit) in _LEGACY_FRONTEND_HOSTS:
            return _CANONICAL_PRODUCTION_URL
        return explicit.rstrip("/")

    render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip().lower()
    if render_host in _LEGACY_FRONTEND_HOSTS:
        return _CANONICAL_PRODUCTION_URL
    if render_host:
        return f"https://{render_host}"

    return ""


def public_origin_parts(url: str) -> tuple[str, str]:
    """Return (hostname, origin) for ALLOWED_HOSTS / CSRF, or empty strings."""
    if not url:
        return "", ""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").strip()
    origin = (
        f"{parsed.scheme}://{parsed.netloc}"
        if parsed.scheme and parsed.netloc
        else ""
    )
    return host, origin
