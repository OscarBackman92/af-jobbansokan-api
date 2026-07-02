"""Lightweight checks that outbound e-mail is likely to work."""

from __future__ import annotations

import os
import time

import requests

_CACHE: dict[str, object] = {"checked_at": 0.0, "ok": None, "detail": ""}
_CACHE_TTL_SECONDS = 300


def probe_brevo_api_key(
    *, api_key: str | None = None, timeout: float = 5
) -> tuple[bool, str]:
    """Return (ok, detail) by calling Brevo's account endpoint.

    A 200 means the API key is valid. Send failures (unverified sender, etc.)
    may still happen at send time — use ``send_test_email`` for an end-to-end
    check.
    """
    key = (api_key if api_key is not None else os.getenv("BREVO_API_KEY", "")).strip()
    if not key:
        return False, "no_brevo_api_key"

    try:
        response = requests.get(
            "https://api.brevo.com/v3/account",
            headers={"api-key": key, "accept": "application/json"},
            timeout=timeout,
        )
    except requests.RequestException as exc:
        return False, f"brevo_unreachable:{exc.__class__.__name__}"

    if response.status_code == 200:
        return True, "ok"
    if response.status_code in {401, 403}:
        return False, "brevo_api_key_rejected"
    return False, f"brevo_http_{response.status_code}"


def probe_brevo_api_key_cached() -> tuple[bool, str]:
    """Cached Brevo probe so /health/ does not hammer the API."""
    now = time.monotonic()
    checked_at = float(_CACHE["checked_at"])
    if now - checked_at < _CACHE_TTL_SECONDS and _CACHE["ok"] is not None:
        return bool(_CACHE["ok"]), str(_CACHE["detail"])

    ok, detail = probe_brevo_api_key()
    _CACHE["checked_at"] = now
    _CACHE["ok"] = ok
    _CACHE["detail"] = detail
    return ok, detail


def clear_brevo_probe_cache() -> None:
    """For tests."""
    _CACHE["checked_at"] = 0.0
    _CACHE["ok"] = None
    _CACHE["detail"] = ""


def email_delivery_warnings(*, debug: bool) -> list[str]:
    """Warnings for /health/ when e-mail may not work in production."""
    if debug:
        return []

    from core.email_config import email_is_configured

    if not email_is_configured():
        return ["email_not_configured"]

    if os.getenv("BREVO_API_KEY"):
        ok, detail = probe_brevo_api_key_cached()
        if not ok:
            return [f"email_delivery_unavailable:{detail}"]

    return []
