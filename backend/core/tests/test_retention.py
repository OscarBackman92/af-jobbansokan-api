"""Tests for the GDPR retention command (prune_inactive_accounts)."""

from datetime import timedelta

import pytest
from allauth.account.models import EmailAddress
from core.models import OperatorProfile
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

pytestmark = pytest.mark.django_db

User = get_user_model()

TWO_YEARS = timedelta(days=731)


@pytest.fixture
def mail_configured(settings, monkeypatch):
    """Make email_is_configured() true while capturing mail in memory."""
    monkeypatch.setenv("EMAIL_HOST", "smtp.test")
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


def make_user(email, *, joined_ago, last_login_ago=None, **extra):
    user = User.objects.create_user(
        username=email.split("@")[0], email=email, password="x", **extra
    )
    # auto_now_add fields must be updated after creation.
    User.objects.filter(pk=user.pk).update(
        date_joined=timezone.now() - joined_ago,
        last_login=(
            timezone.now() - last_login_ago if last_login_ago is not None else None
        ),
    )
    user.refresh_from_db()
    EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
    return user


def test_inactive_user_gets_warning_mail_first(mail_configured):
    user = make_user("gammal@example.com", joined_ago=TWO_YEARS)

    call_command("prune_inactive_accounts")

    assert User.objects.filter(pk=user.pk).exists(), "must not delete before warning"
    profile = OperatorProfile.objects.get(user=user)
    assert profile.deletion_warned_at is not None
    assert len(mail.outbox) == 1
    assert "raderas om 30 dagar" in mail.outbox[0].subject
    assert mail.outbox[0].to == ["gammal@example.com"]


def test_user_deleted_after_grace_period(mail_configured):
    user = make_user("borta@example.com", joined_ago=TWO_YEARS)
    profile = OperatorProfile.objects.get(user=user)
    profile.deletion_warned_at = timezone.now() - timedelta(days=31)
    profile.save()

    call_command("prune_inactive_accounts")

    assert not User.objects.filter(pk=user.pk).exists()


def test_user_kept_during_grace_period(mail_configured):
    user = make_user("vantar@example.com", joined_ago=TWO_YEARS)
    profile = OperatorProfile.objects.get(user=user)
    profile.deletion_warned_at = timezone.now() - timedelta(days=5)
    profile.save()

    call_command("prune_inactive_accounts")

    assert User.objects.filter(pk=user.pk).exists()
    assert len(mail.outbox) == 0, "no duplicate warning during the grace period"


def test_recent_activity_clears_warning(mail_configured):
    user = make_user(
        "aktiv@example.com", joined_ago=TWO_YEARS, last_login_ago=timedelta(days=1)
    )
    profile = OperatorProfile.objects.get(user=user)
    profile.deletion_warned_at = timezone.now() - timedelta(days=10)
    profile.save()

    call_command("prune_inactive_accounts")

    profile.refresh_from_db()
    assert profile.deletion_warned_at is None
    assert User.objects.filter(pk=user.pk).exists()


def test_active_and_staff_users_untouched(mail_configured):
    fresh = make_user("ny@example.com", joined_ago=timedelta(days=10))
    admin = make_user("ops@example.com", joined_ago=TWO_YEARS, is_staff=True)

    call_command("prune_inactive_accounts")

    assert User.objects.filter(pk=fresh.pk).exists()
    assert User.objects.filter(pk=admin.pk).exists()
    assert len(mail.outbox) == 0


def test_dry_run_changes_nothing(mail_configured):
    user = make_user("torr@example.com", joined_ago=TWO_YEARS)

    call_command("prune_inactive_accounts", "--dry-run")

    profile = OperatorProfile.objects.get(user=user)
    assert profile.deletion_warned_at is None
    assert len(mail.outbox) == 0
    assert User.objects.filter(pk=user.pk).exists()


def test_no_deletion_when_email_not_configured(monkeypatch):
    """Without a mail backend we cannot warn, so nothing may be deleted."""
    monkeypatch.delenv("EMAIL_HOST", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    user = make_user("mejllos@example.com", joined_ago=TWO_YEARS)
    profile = OperatorProfile.objects.get(user=user)
    profile.deletion_warned_at = timezone.now() - timedelta(days=31)
    profile.save()

    call_command("prune_inactive_accounts")

    assert User.objects.filter(pk=user.pk).exists()
