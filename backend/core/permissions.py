from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsEmployerAdminOrReadOnly(BasePermission):
    """
    Allow public read (GET/HEAD/OPTIONS).
    Allow write only for authenticated users with EmployerProfile role=admin.
    """

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        profile = getattr(user, "employer_profile", None)
        return bool(profile and profile.role == "admin")
