import os

from django.conf import settings
from django.core.checks import Warning, register


@register(deploy=True)
def email_host_configured(**kwargs):
    if settings.DEBUG or os.getenv("EMAIL_HOST"):
        return []
    return [
        Warning(
            "EMAIL_HOST is not set. Password reset and reminder e-mails will not be sent.",
            hint="Configure EMAIL_HOST, EMAIL_HOST_USER and EMAIL_HOST_PASSWORD on Render.",
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
