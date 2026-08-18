from datetime import date
from types import SimpleNamespace

import pytest
from core.models import Activity, JobApplication, ReportPeriod
from core.periods import status_for, submit_period, window
from django.utils import timezone

pytestmark = pytest.mark.django_db

URL = "/api/v1/periods/"


def _applied(user, *, company, applied_at, title="Dev"):
    return JobApplication.objects.create(
        owner=user,
        company=company,
        title=title,
        status="applied",
        applied_at=applied_at,
    )


def test_status_for_all_outcomes_and_boundaries():
    period = SimpleNamespace(year=2026, month=7, submitted_at=None)
    assert window(2026, 7) == (date(2026, 8, 1), date(2026, 8, 14))
    assert status_for(period, date(2026, 7, 31)) == "pagaende"
    assert status_for(period, date(2026, 8, 1)) == "klar"
    assert status_for(period, date(2026, 8, 14)) == "klar"
    assert status_for(period, date(2026, 8, 15)) == "forsenad"
    period.submitted_at = timezone.now()
    assert status_for(period, date(2026, 8, 10)) == "rapporterad"


def test_list_creates_periods_lazily_from_applied_at(api_client, user):
    _applied(user, company="Juni", applied_at=date(2026, 6, 10))
    _applied(user, company="Juli", applied_at=date(2026, 7, 4))
    _applied(user, company="Augusti", applied_at=date(2026, 8, 2))
    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    keys = {row["key"] for row in body["results"]}
    assert {"2026-06", "2026-07", "2026-08"} <= keys
    june = next(row for row in body["results"] if row["key"] == "2026-06")
    assert june["job_count"] == 1
    assert june["status"] == status_for(
        SimpleNamespace(year=2026, month=6, submitted_at=None),
        timezone.localdate(),
    )


def test_submit_is_idempotent_and_links_jobs(api_client, user):
    app = _applied(user, company="Acme", applied_at=date(2026, 6, 10))
    Activity.objects.create(
        user=user,
        type=Activity.TYPE_CV_ARBETE,
        occurred_on=date(2026, 6, 12),
        title="Uppdaterade CV",
    )
    api_client.force_authenticate(user)
    first = api_client.post(f"{URL}2026-06/submit/")
    second = api_client.post(f"{URL}2026-06/submit/")
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["submitted_at"] == second.json()["submitted_at"]
    app.refresh_from_db()
    assert app.reported_in_id is not None
    assert first.json()["status"] == "rapporterad"
    assert first.json()["job_count"] == 1
    assert first.json()["activity_count"] == 1


def test_reopen_clears_submitted_at(api_client, user):
    _applied(user, company="Acme", applied_at=date(2026, 6, 10))
    api_client.force_authenticate(user)
    api_client.post(f"{URL}2026-06/submit/")
    response = api_client.post(f"{URL}2026-06/reopen/")
    assert response.status_code == 200
    assert response.json()["submitted_at"] is None
    assert response.json()["status"] != "rapporterad"


def test_cannot_move_applied_at_into_reported_period(api_client, user):
    old = _applied(user, company="Juni", applied_at=date(2026, 6, 10))
    later = _applied(user, company="Augusti", applied_at=date(2026, 8, 2))
    period = ReportPeriod.objects.create(
        user=user, year=2026, month=6, submitted_at=timezone.now()
    )
    submit_period(period)
    api_client.force_authenticate(user)
    response = api_client.patch(
        f"/api/v1/applications/{later.id}/",
        {"applied_at": "2026-06-15"},
    )
    assert response.status_code == 400
    later.refresh_from_db()
    assert later.applied_at == date(2026, 8, 2)
    old.refresh_from_db()
    assert old.reported_in_id == period.id


def test_moving_applied_at_out_of_period_clears_reported_in(api_client, user):
    app = _applied(user, company="Juni", applied_at=date(2026, 6, 10))
    period = ReportPeriod.objects.create(user=user, year=2026, month=6)
    submit_period(period)
    app.refresh_from_db()
    assert app.reported_in_id == period.id
    api_client.force_authenticate(user)
    response = api_client.patch(
        f"/api/v1/applications/{app.id}/",
        {"applied_at": "2026-08-02"},
    )
    assert response.status_code == 200
    app.refresh_from_db()
    assert app.applied_at == date(2026, 8, 2)
    assert app.reported_in_id is None
