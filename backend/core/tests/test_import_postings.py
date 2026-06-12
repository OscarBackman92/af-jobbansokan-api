from io import StringIO

import pytest
from core.management.commands import import_postings
from core.models import JobPosting
from django.core.management import call_command

pytestmark = pytest.mark.django_db

SAMPLE_HITS = [
    {
        "id": "29000001",
        "headline": "Backend Developer",
        "employer": {"name": "Acme AB"},
        "workplace_address": {"municipality": "Stockholm"},
        "publication_date": "2026-06-01T08:00:00",
        "application_deadline": "2026-07-01T23:59:59",
        "description": {"text": "Vi söker en backendutvecklare."},
        "webpage_url": "https://arbetsformedlingen.se/platsbanken/annonser/29000001",
    },
    {
        "id": "29000002",
        "headline": "Data Engineer",
        "employer": None,
        "workplace_address": None,
        "publication_date": None,
    },
    {
        # Missing headline -> skipped
        "id": "29000003",
        "headline": "",
    },
]


class FakeResponse:
    def __init__(self, hits):
        self._hits = hits

    def raise_for_status(self):
        pass

    def json(self):
        return {"hits": self._hits}


@pytest.fixture
def mock_jobtech(monkeypatch):
    calls = []

    def fake_get(url, params=None, timeout=None):
        calls.append({"url": url, "params": params})
        return FakeResponse(SAMPLE_HITS)

    monkeypatch.setattr(import_postings.requests, "get", fake_get)
    return calls


def test_to_posting_fields_maps_hit():
    fields = import_postings.to_posting_fields(SAMPLE_HITS[0])
    assert fields == {
        "title": "Backend Developer",
        "company_name": "Acme AB",
        "location": "Stockholm",
        "description": "Vi söker en backendutvecklare.",
        "webpage_url": ("https://arbetsformedlingen.se/platsbanken/annonser/29000001"),
        "published_at": "2026-06-01",
        "application_deadline": "2026-07-01",
    }


def test_to_posting_fields_handles_missing_data():
    fields = import_postings.to_posting_fields(SAMPLE_HITS[1])
    assert fields == {
        "title": "Data Engineer",
        "company_name": "",
        "location": "",
        "description": "",
        "webpage_url": "",
        "published_at": None,
        "application_deadline": None,
    }


def test_import_creates_postings(mock_jobtech):
    out = StringIO()
    call_command("import_postings", "--query", "python", stdout=out)

    assert "Imported 2 new, updated 0, skipped 1." in out.getvalue()
    posting = JobPosting.objects.get(source="jobtech", external_id="29000001")
    assert posting.title == "Backend Developer"
    assert str(posting.application_deadline) == "2026-07-01"
    assert mock_jobtech[0]["params"]["q"] == "python"


def test_import_is_idempotent(mock_jobtech):
    call_command("import_postings", stdout=StringIO())
    out = StringIO()
    call_command("import_postings", stdout=out)

    assert "Imported 0 new, updated 2, skipped 1." in out.getvalue()
    assert JobPosting.objects.filter(source="jobtech").count() == 2
