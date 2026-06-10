from __future__ import annotations

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class BankIDRateThrottle(AnonRateThrottle):
    """Per-IP limit on the mock BankID endpoints."""

    scope = "bankid"


class PartnerRateThrottle(SimpleRateThrottle):
    """Per-partner-client limit on the partner API."""

    scope = "partner"

    def get_cache_key(self, request, view):
        client = getattr(request, "auth", None)
        ident = getattr(client, "id", None) or self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
