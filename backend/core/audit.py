"""Utility for writing immutable audit log entries."""
from __future__ import annotations

from typing import Any


def _get_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log(
    request,
    action: str,
    resource: str = "",
    resource_id: str | int = "",
    detail: dict[str, Any] | None = None,
) -> None:
    """
    Write one audit log entry.  Fails silently so it never breaks a request.
    Import is deferred to avoid circular imports at module load time.
    """
    try:
        from .models import AuditLog  # noqa: PLC0415

        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action=action,
            resource=resource,
            resource_id=str(resource_id),
            ip_address=_get_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
            detail=detail or {},
        )
    except Exception:  # noqa: BLE001
        pass
