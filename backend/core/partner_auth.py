from __future__ import annotations

import hashlib

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import authentication, exceptions
from rest_framework.permissions import BasePermission

from .models import PartnerClient


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


class PartnerAPIKeyAuthentication(authentication.BaseAuthentication):
    """Authenticate partner systems via `Authorization: Api-Key <key>`.

    On success, request.auth is the PartnerClient (request.user stays
    anonymous — partners are systems, not users).
    """

    keyword = "Api-Key"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode()
        if not header.startswith(f"{self.keyword} "):
            return None

        key = header[len(self.keyword) + 1 :].strip()
        try:
            client = PartnerClient.objects.get(key_hash=hash_key(key), is_active=True)
        except PartnerClient.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Invalid API key.") from exc

        return (None, client)

    def authenticate_header(self, request):
        return self.keyword


class PartnerAPIKeyScheme(OpenApiAuthenticationExtension):
    """OpenAPI security scheme for partner API key auth."""

    target_class = "core.partner_auth.PartnerAPIKeyAuthentication"
    name = "partnerApiKey"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Format: `Api-Key <key>`",
        }


class IsPartner(BasePermission):
    """Allows access only to authenticated partner clients."""

    def has_permission(self, request, view) -> bool:
        return isinstance(request.auth, PartnerClient)
