from __future__ import annotations

from .models import AuditLog


def log_event(actor, action: str, target=None, **metadata) -> AuditLog:
    """Record an audit log entry.

    Keep metadata minimal (ids and counts, no PII) — entries are retained
    even after the underlying records are deleted.
    """
    return AuditLog.objects.create(
        actor=actor if actor is not None and actor.is_authenticated else None,
        action=action,
        target_type=type(target).__name__ if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        metadata=metadata,
    )
