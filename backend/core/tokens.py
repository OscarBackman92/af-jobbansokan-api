"""JWT housekeeping helpers."""

from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)


def revoke_refresh_tokens(user):
    """Blacklist every outstanding refresh token the user holds.

    Called after a password change or reset so stolen or forgotten
    sessions on other devices cannot be refreshed past the 15-minute
    access-token window.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
