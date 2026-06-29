import os

from core.email_config import email_is_configured
from django.conf import settings
from django.core.checks import Warning, register


@register(deploy=True)
def email_host_configured(**kwargs):
    if settings.DEBUG or email_is_configured():
        return []
    return [
        Warning(
            "No e-mail backend configured. Verification, password reset and "
            "reminder e-mails will not be sent.",
            hint="Set BREVO_API_KEY (recommended on Render) or EMAIL_HOST for SMTP.",
            id="core.E001",
        )
    ]


@register(deploy=True)
def sentry_dsn_configured(**kwargs):
    if settings.DEBUG or os.getenv("SENTRY_DSN"):
        return []
    return [
        Warning(
            "SENTRY_DSN is not set. Unhandled server errors will not be reported.",
            hint="Create a Sentry project and set SENTRY_DSN in production.",
            id="core.W001",
        )
    ]
