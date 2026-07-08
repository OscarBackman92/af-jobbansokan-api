import os

from django.conf import settings
from django.core.checks import Warning, register

from core.email_config import email_is_configured

_WEAK_ADMIN_USERNAMES = frozenset({"admin", "administrator", "root", "superuser"})


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


@register(deploy=True)
def admin_username_not_predictable(**kwargs):
    if settings.DEBUG:
        return []
    username = os.getenv("DJANGO_SUPERUSER_USERNAME", "").strip().lower()
    if not username or username not in _WEAK_ADMIN_USERNAMES:
        return []
    return [
        Warning(
            f"DJANGO_SUPERUSER_USERNAME is '{username}', which is easy to guess.",
            hint="Set a unique admin username in Render env vars (sync: false).",
            id="core.W002",
        )
    ]


@register(deploy=True)
def sentry_allowed_domains_reminder(**kwargs):
    if settings.DEBUG or not os.getenv("SENTRY_DSN"):
        return []
    return [
        Warning(
            "Configure Sentry Allowed Domains for the frontend DSN.",
            hint=(
                "In Sentry → Project Settings → Security → Allowed Domains, "
                "allow only your production hostname (e.g. jobbjungeln.onrender.com)."
            ),
            id="core.W003",
        )
    ]
