"""Public URL helpers for the React SPA under /app/."""

from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest

SPA_APP_PATH = "/app"


def spa_path_prefix() -> str:
    return f"{SPA_APP_PATH.rstrip('/')}/"


def spa_public_origin(request: HttpRequest | None = None) -> str:
    if settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip("/")
    if request is not None:
        return f"{request.scheme}://{request.get_host()}"
    return ""


def spa_app_url(*, request: HttpRequest | None = None, query: str = "") -> str:
    """Absolute URL to the SPA entry (e-mail links, cron copy)."""
    url = f"{spa_public_origin(request)}{spa_path_prefix()}"
    if query:
        url = f"{url}?{query.lstrip('?')}"
    return url
