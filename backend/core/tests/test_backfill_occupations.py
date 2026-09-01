from datetime import date

import pytest
import requests
from core import jobtech
from core.models import JobApplication
from django.core.management import call_command

pytestmark = pytest.mark.django_db

HISTORICAL_PAYLOAD = {
    "id": "31350401",
    "headline": "Vi söker en ekonomiassistent",
    "employer": {"name": "Acme AB"},
    "workplace_address": {"municipality": "Stockholm", "city": "Kista"},
    "occupation": {
        "concept_id": "BK8D_hZe_dtk",
        "label": "Ekonomiassistent",
        "legacy_ams_taxonomy_id": "6024",
    },
    "occupation_group": {
        "concept_id": "ij8k_EwC_zyB",
        "label": "Ekonomiassistenter m.fl.",
    },
    "working_hours_type": {"concept_id": "6YE1_gAC_R2G", "label": "Heltid"},
    "scope_of_work": {"min": 100, "max": 100},
    "webpage_url": "https://arbetsformedlingen.se/platsbanken/annonser/31350401",
    "description": {"text": "Bokföring."},
}


class FakeResponse:
    def __init__(self, payload=None, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")

    def json(self):
        return self._payload


def _platsbanken_app(user, *, source_job_id="31350401", **kwargs):
    defaults = {
        "owner": user,
        "company": "Acme AB",
        "title": "Ekonomiassistent",
        "status": "applied",
        "source": JobApplication.SOURCE_PLATSBANKEN,
        "source_job_id": source_job_id,
        "applied_at": date(2026, 8, 5),
    }
    defaults.update(kwargs)
    return JobApplication.objects.create(**defaults)


def test_backfill_dry_run_does_not_write(user, monkeypatch):
    app = _platsbanken_app(user)
    calls = []

    def fake_get(url, timeout=None):
        calls.append(url)
        return FakeResponse(HISTORICAL_PAYLOAD)

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    call_command("backfill_occupations", delay=0)
    app.refresh_from_db()
    assert app.occupation_concept_id == ""
    assert calls
    assert calls[0].endswith("/31350401")


def test_backfill_apply_fills_from_historical(user, monkeypatch):
    app = _platsbanken_app(user)

    def fake_get(url, timeout=None):
        return FakeResponse(HISTORICAL_PAYLOAD)

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    call_command("backfill_occupations", dry_run=False, delay=0)
    app.refresh_from_db()
    assert app.occupation_concept_id == "BK8D_hZe_dtk"
    assert app.occupation_label == "Ekonomiassistent"
    assert app.occupation_group_label == "Ekonomiassistenter m.fl."
    assert app.working_hours_type == "Heltid"
    assert app.scope_of_work_min == 100
    assert app.scope_of_work_max == 100


def test_backfill_does_not_overwrite_existing_label(user, monkeypatch):
    app = _platsbanken_app(user, occupation_label="Manuell roll")

    def fake_get(url, timeout=None):
        return FakeResponse(HISTORICAL_PAYLOAD)

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    call_command("backfill_occupations", dry_run=False, delay=0)
    app.refresh_from_db()
    assert app.occupation_label == "Manuell roll"
    assert app.occupation_concept_id == "BK8D_hZe_dtk"


def test_backfill_tolerates_404(user, monkeypatch):
    app = _platsbanken_app(user, source_job_id="31350400")

    def fake_get(url, timeout=None):
        return FakeResponse(None, status_code=404)

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    call_command("backfill_occupations", dry_run=False, delay=0)
    app.refresh_from_db()
    assert app.occupation_concept_id == ""


def test_backfill_is_idempotent(user, monkeypatch):
    app = _platsbanken_app(user)
    calls = []

    def fake_get(url, timeout=None):
        calls.append(url)
        return FakeResponse(HISTORICAL_PAYLOAD)

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    call_command("backfill_occupations", dry_run=False, delay=0)
    call_command("backfill_occupations", dry_run=False, delay=0)
    app.refresh_from_db()
    assert app.occupation_concept_id == "BK8D_hZe_dtk"
    assert len(calls) == 1


def test_backfill_skips_non_platsbanken(user, monkeypatch):
    app = _platsbanken_app(user, source=JobApplication.SOURCE_LINKEDIN)

    def fake_get(url, timeout=None):
        raise AssertionError("should not fetch")

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    call_command("backfill_occupations", dry_run=False, delay=0)
    app.refresh_from_db()
    assert app.occupation_concept_id == ""
