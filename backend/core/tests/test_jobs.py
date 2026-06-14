import pytest
import requests
from core import jobtech
from core.models import Resume

pytestmark = pytest.mark.django_db

SEARCH_URL = "/api/v1/jobs/"
FILTERS_URL = "/api/v1/jobs/filters/"

SAMPLE_PAYLOAD = {
    "total": {"value": 3},
    "hits": [
        {
            "id": "1001",
            "headline": "Backendutvecklare Python",
            "employer": {"name": "Acme AB"},
            "workplace_address": {"municipality": "Stockholm"},
            "publication_date": "2026-06-10T08:00:00",
            "application_deadline": "2026-07-10T23:59:59",
            "description": {"text": "Vi arbetar med Python och Django."},
            "webpage_url": "https://arbetsformedlingen.se/annons/1001",
            "remote_work": True,
        }
    ],
}


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


@pytest.fixture
def mock_jobtech(monkeypatch):
    calls = []

    def fake_get(url, params=None, timeout=None):
        calls.append(dict(params))
        return FakeResponse(SAMPLE_PAYLOAD)

    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    return calls


def test_search_requires_auth(api_client):
    assert api_client.get(SEARCH_URL).status_code == 401


def test_filters_lists_regions_and_fields(api_client, user):
    api_client.force_authenticate(user)
    body = api_client.get(FILTERS_URL).json()
    assert len(body["regions"]) == 21
    assert len(body["fields"]) == 21
    assert {"id": "apaJ_2ja_LuF", "label": "Data/IT"} in body["fields"]


def test_search_maps_hits(api_client, user, mock_jobtech):
    api_client.force_authenticate(user)
    body = api_client.get(SEARCH_URL, {"q": "python"}).json()
    assert body["total"] == 3
    job = body["results"][0]
    assert job["title"] == "Backendutvecklare Python"
    assert job["company_name"] == "Acme AB"
    assert job["location"] == "Stockholm"
    assert job["application_deadline"] == "2026-07-10"
    assert job["remote"] is True
    assert mock_jobtech[0]["q"] == "python"


def test_search_forwards_known_filters_only(api_client, user, mock_jobtech):
    api_client.force_authenticate(user)
    api_client.get(
        SEARCH_URL,
        {"region": "CifL_Rzy_Mku", "field": "bogus-id", "remote": "true"},
    )
    sent = mock_jobtech[0]
    assert sent["region"] == "CifL_Rzy_Mku"
    assert "occupation-field" not in sent  # unknown id dropped
    assert sent["remote"] == "true"


def test_search_adds_cv_match(api_client, user, mock_jobtech):
    Resume.objects.create(user=user, skills=["Python", "Rust"])
    api_client.force_authenticate(user)
    body = api_client.get(SEARCH_URL, {"q": "python"}).json()
    assert body["results"][0]["match"]["count"] == 1
    assert body["results"][0]["match"]["matched"] == ["Python"]


def test_search_handles_upstream_failure(api_client, user, monkeypatch):
    def boom(url, params=None, timeout=None):
        raise requests.RequestException("down")

    monkeypatch.setattr(jobtech.requests, "get", boom)
    api_client.force_authenticate(user)
    response = api_client.get(SEARCH_URL, {"q": "python"})
    assert response.status_code == 502
