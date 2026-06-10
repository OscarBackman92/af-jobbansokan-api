from __future__ import annotations

import hashlib
import hmac

from django.conf import settings


def normalize_personal_number(value: str) -> str | None:
    """Return the 12-digit form (YYYYMMDDNNNN), or None if invalid."""
    digits = value.replace("-", "").replace(" ", "")
    if len(digits) == 12 and digits.isdigit():
        return digits
    return None


def pseudonymize_personal_number(personal_number: str) -> str:
    """Keyed hash (HMAC-SHA256) of a normalized personal identity number.

    Keyed rather than a plain digest: the personnummer key space is small
    enough to brute-force, so hashes must be useless without the
    server-side key. See docs/08-identity-bankid.md.
    """
    return hmac.new(
        settings.PERSON_HASH_KEY.encode(),
        personal_number.encode(),
        hashlib.sha256,
    ).hexdigest()
