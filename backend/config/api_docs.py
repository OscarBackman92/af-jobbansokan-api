"""OpenAPI / Swagger access control."""

from django.conf import settings
from rest_framework.permissions import BasePermission, IsAdminUser


class DebugOrAdminPermission(BasePermission):
    """Public API docs in development; staff-only in production."""

    def has_permission(self, request, view):
        if settings.DEBUG:
            return True
        return IsAdminUser().has_permission(request, view)
