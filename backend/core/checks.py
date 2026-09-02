import os

from django.conf import settings
from django.core.checks import Error, Warning, register

from core.email_config import email_is_configured

_WEAK_ADMIN_USERNAMES = frozenset({"admin", "administrator", "root", "superuser"})
_INSECURE_SECRET_KEY = "dev-insecure-secret-key"


@register(deploy=True)
def secret_key_not_insecure(**kwargs):
    if settings.DEBUG or settings.SECRET_KEY != _INSECURE_SECRET_KEY:
        return []
    return [
        Error(
            "DJANGO_SECRET_KEY is the insecure development fallback.",
            hint="Set a unique DJANGO_SECRET_KEY in Render → Environment.",
            id="core.E003",
        )
    ]


@register(deploy=True)
def database_url_configured(**kwargs):
    if settings.DEBUG or os.getenv("DATABASE_URL", "").strip():
        return []
    return [
        Error(
            "DATABASE_URL is required when DJANGO_DEBUG=0.",
            hint="Set the Supabase connection string in Render → Environment.",
            id="core.E002",
        )
    ]


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
