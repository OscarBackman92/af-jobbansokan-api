import secrets

from .models import OperatorProfile

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_operator_id() -> str:
    """Allocate a unique public operator id, e.g. ANS-K7M2XQ."""
    for _ in range(32):
        candidate = "ANS-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if not OperatorProfile.objects.filter(operator_id=candidate).exists():
            return candidate
    raise RuntimeError("Could not allocate a unique operator id.")
