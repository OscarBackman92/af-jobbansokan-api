import os

import pytest
from django.core.management import call_command
from django.core import mail

from core.models import JobApplication


@pytest.mark.django_db
def test_send_reminders_dry_run(user):
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        next_action_at="2020-01-01",
    )
    call_command("send_reminders", "--dry-run")
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_reminders_sends_mail(user, settings, monkeypatch):
    monkeypatch.setenv("EMAIL_HOST", "smtp.test")
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    user.email = "anna@example.com"
    user.save(update_fields=["email"])

    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        next_action_at="2020-01-01",
    )
    call_command("send_reminders")
    assert len(mail.outbox) == 1
    assert user.email in mail.outbox[0].to
    assert "Acme" in mail.outbox[0].body


@pytest.mark.django_db
def test_send_reminders_skips_without_smtp(monkeypatch):
    monkeypatch.delenv("EMAIL_HOST", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    call_command("send_reminders")
