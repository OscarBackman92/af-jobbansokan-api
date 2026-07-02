"""Tests for weekly summary e-mail logic and command."""

from datetime import date, timedelta

import pytest
from core.models import (
    ApplicationEvent,
    JobApplication,
    OperatorProfile,
    SavedJobSearch,
)
from core.search_digest import build_search_digests, since_date_for_search
from core.weekly_summary import (
    build_weekly_summary,
    format_weekly_summary_email,
    summary_has_content,
    week_bounds,
)
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

pytestmark = pytest.mark.django_db

User = get_user_model()
MONDAY = date(2026, 6, 29)  # a Monday


@pytest.fixture
def mail_configured(settings, monkeypatch):
    monkeypatch.setenv("EMAIL_HOST", "smtp.test")
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.FRONTEND_URL = "https://jobbsoket.example.com"


def test_week_bounds_from_monday():
    bounds = week_bounds(MONDAY)
    assert bounds.last_start == date(2026, 6, 22)
    assert bounds.last_end == date(2026, 6, 28)
    assert bounds.ahead_start == date(2026, 6, 29)
    assert bounds.ahead_end == date(2026, 7, 5)


def test_build_weekly_summary_groups_activity(user):
    app = JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Backend",
        status="applied",
        applied_at=date(2026, 6, 25),
        next_action_at=date(2026, 6, 20),
    )
    JobApplication.objects.create(
        owner=user,
        company="Beta",
        title="QA",
        status="wishlist",
        deadline=date(2026, 7, 2),
    )
    ApplicationEvent.objects.create(
        application=app,
        occurred_at=date(2026, 6, 24),
        note="Telefonintervju",
        status="screening",
    )

    summary = build_weekly_summary(user.job_applications.all(), today=MONDAY)

    assert len(summary.applied_last_week) == 1
    assert len(summary.interviews_last_week) == 1
    assert len(summary.overdue) == 1
    assert summary.overdue[0].title == "Backend"
    assert len(summary.deadlines) == 1
    assert summary.active_count == 2


def test_summary_has_content_requires_something():
    summary = build_weekly_summary(JobApplication.objects.none(), today=MONDAY)
    assert not summary_has_content(summary, digest_count=0)
    assert summary_has_content(summary, digest_count=1)


def test_format_email_includes_sections(user):
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date(2026, 6, 25),
        next_action_at=date(2026, 6, 30),
    )
    summary = build_weekly_summary(user.job_applications.all(), today=MONDAY)
    subject, body = format_weekly_summary_email(
        summary,
        digests=[("Python", [{"title": "Senior Dev", "company_name": "Foo"}])],
        frontend_url="https://jobbsoket.example.com",
    )
    assert "veckosammanfattning" in subject
    assert "FÖRRA VECKAN" in body
    assert "ATT GÖRA" in body
    assert "NYA ANNONSER" in body
    assert "Senior Dev @ Foo" in body
    assert "https://jobbsoket.example.com" in body


def test_since_date_defaults_to_one_week(user):
    search = SavedJobSearch.objects.create(owner=user, q="python")
    since = since_date_for_search(search, today=MONDAY)
    assert since == MONDAY - timedelta(days=7)


def test_build_search_digests_uses_jobtech(user, monkeypatch):
    SavedJobSearch.objects.create(owner=user, label="Python", q="python")

    def fake_search(**_kwargs):
        return {
            "total": 1,
            "results": [
                {
                    "id": "1",
                    "title": "Ny roll",
                    "company_name": "Acme",
                    "published_at": "2026-06-28",
                }
            ],
        }

    monkeypatch.setattr("core.search_digest.jobtech.search", fake_search)
    digests = build_search_digests(user.saved_job_searches.all(), today=MONDAY)
    assert digests == [
        (
            "Python",
            [
                {
                    "id": "1",
                    "title": "Ny roll",
                    "company_name": "Acme",
                    "published_at": "2026-06-28",
                }
            ],
        )
    ]


def test_send_weekly_summary_skips_non_monday(mail_configured, user):
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date(2026, 6, 25),
    )
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(timezone, "localdate", lambda: date(2026, 6, 30))  # Tuesday
        call_command("send_weekly_summary")
    assert len(mail.outbox) == 0


def test_send_weekly_summary_sends_on_monday(mail_configured, user):
    user.email = "anna@example.com"
    user.save(update_fields=["email"])
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date(2026, 6, 25),
        next_action_at=date(2026, 6, 30),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(timezone, "localdate", lambda: MONDAY)
        mp.setattr(
            "core.management.commands.send_weekly_summary.build_search_digests",
            lambda *_a, **_k: [],
        )
        call_command("send_weekly_summary", "--force")

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["anna@example.com"]
    assert "veckosammanfattning" in mail.outbox[0].subject
    profile = OperatorProfile.objects.get(user=user)
    assert profile.weekly_summary_sent_at is not None


def test_send_weekly_summary_idempotent_same_week(mail_configured, user):
    user.email = "anna@example.com"
    user.save(update_fields=["email"])
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date(2026, 6, 25),
    )
    profile = OperatorProfile.objects.get(user=user)
    profile.weekly_summary_sent_at = timezone.now()
    profile.save()

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(timezone, "localdate", lambda: MONDAY)
        call_command("send_weekly_summary")

    assert len(mail.outbox) == 0


def test_send_weekly_summary_requires_verified_email(mail_configured, db):
    user = User.objects.create_user(
        username="unverified",
        email="nobody@example.com",
        password="x",
    )
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date(2026, 6, 25),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(timezone, "localdate", lambda: MONDAY)
        call_command("send_weekly_summary", "--force")

    assert len(mail.outbox) == 0
