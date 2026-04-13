"""
Custom throttle classes for sensitive endpoints.

Auth endpoints (login, register) use a much tighter rate than
regular API endpoints to prevent credential-stuffing attacks.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthAnonThrottle(AnonRateThrottle):
    """10 login/register attempts per minute per IP — anonymous."""
    rate = "10/minute"
    scope = "auth"


class AuthUserThrottle(UserRateThrottle):
    """20 auth attempts per minute per authenticated user."""
    rate = "20/minute"
    scope = "auth"


class BurstAnonThrottle(AnonRateThrottle):
    """60 requests per minute — short burst limit for anonymous users."""
    rate = "60/minute"
    scope = "burst"
