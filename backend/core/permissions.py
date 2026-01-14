from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsEmployerAdminOrReadOnly(BasePermission):
    """
    Public read.
    Write only for authenticated employer admins.
    """

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        profile = getattr(user, "employer_profile", None)
        return bool(profile and profile.role == "admin")


class IsEmployer(BasePermission):
    """
    Allows access only to authenticated users with an EmployerProfile.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        return hasattr(user, "employer_profile")
