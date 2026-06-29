from allauth.account.models import EmailAddress
from django.conf import settings
from rest_framework.permissions import BasePermission


from rest_framework.permissions import BasePermission, IsAuthenticated


class IsEmailVerified(BasePermission):
    """Block API use until the primary e-mail address is verified."""

    message = "Verifiera din e-postadress innan du fortsätter."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return True
        if settings.ACCOUNT_EMAIL_VERIFICATION != "mandatory":
            return True
        if not user.email:
            return False
        return EmailAddress.objects.filter(
            user=user, email__iexact=user.email, verified=True
        ).exists()


class IsAuthenticatedUser(IsAuthenticated):
    """Authenticated users with a verified e-mail when verification is mandatory."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return IsEmailVerified().has_permission(request, view)
