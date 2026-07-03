from types import SimpleNamespace

import pytest
import requests
from core import jobtech, views
from core.matching import match_skills
from core.models import Resume

pytestmark = pytest.mark.django_db

SEARCH_URL = "/api/v1/jobs/"
FILTERS_URL = "/api/v1/jobs/filters/"
GROUPS_URL = "/api/v1/jobs/groups/"
MUNICIPALITIES_URL = "/api/v1/jobs/municipalities/"

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


def test_groups_lists_occupation_groups_for_field(api_client, user, monkeypatch):
    groups = [
        {
            "id": "DJh5_yyF_hEM",
            "label": "Mjukvaru- och systemutvecklare m.fl.",
            "field_id": "apaJ_2ja_LuF",
        }
    ]
    monkeypatch.setattr(views, "occupation_groups", lambda field: groups)
    api_client.force_authenticate(user)
    body = api_client.get(GROUPS_URL, {"field": "apaJ_2ja_LuF"}).json()
    assert body["groups"] == groups


def test_municipalities_lists_locations_for_region(api_client, user, monkeypatch):
    locations = [
        {
            "id": "AvNB_uwa_6n6",
            "label": "Stockholm",
            "region_id": "CifL_Rzy_Mku",
        }
    ]
    monkeypatch.setattr(views, "municipalities", lambda region: locations)
    api_client.force_authenticate(user)
    body = api_client.get(MUNICIPALITIES_URL, {"region": "CifL_Rzy_Mku"}).json()
    assert body["municipalities"] == locations


def test_occupation_groups_accepts_taxonomy_list_payload(monkeypatch):
    payload = [
        {
            "taxonomy/id": "WZCM_nfS_eAk",
            "taxonomy/preferred-label": "Nationalekonomer och makroanalytiker m.fl.",
        },
        {
            "taxonomy/id": "FfMN_Bw1_qYR",
            "taxonomy/preferred-label": "Banktjänstemän",
        },
    ]

    def fake_get(url, params=None, timeout=None):
        return FakeResponse(payload)

    jobtech.occupation_groups.cache_clear()
    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    try:
        assert jobtech.occupation_groups("X82t_awd_Qyc") == [
            {
                "id": "FfMN_Bw1_qYR",
                "label": "Banktjänstemän",
                "field_id": "X82t_awd_Qyc",
            },
            {
                "id": "WZCM_nfS_eAk",
                "label": "Nationalekonomer och makroanalytiker m.fl.",
                "field_id": "X82t_awd_Qyc",
            },
        ]
    finally:
        jobtech.occupation_groups.cache_clear()


def test_municipalities_accepts_taxonomy_list_payload(monkeypatch):
    payload = [
        {"taxonomy/id": "E4CV_a5E_ucX", "taxonomy/preferred-label": "Danderyd"},
        {"taxonomy/id": "AvNB_uwa_6n6", "taxonomy/preferred-label": "Stockholm"},
    ]

    def fake_get(url, params=None, timeout=None):
        return FakeResponse(payload)

    jobtech.municipalities.cache_clear()
    monkeypatch.setattr(jobtech.requests, "get", fake_get)
    try:
        assert jobtech.municipalities("CifL_Rzy_Mku") == [
            {
                "id": "E4CV_a5E_ucX",
                "label": "Danderyd",
                "region_id": "CifL_Rzy_Mku",
            },
            {
                "id": "AvNB_uwa_6n6",
                "label": "Stockholm",
                "region_id": "CifL_Rzy_Mku",
            },
        ]
    finally:
        jobtech.municipalities.cache_clear()


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


def test_search_forwards_known_filters_only(
    api_client, user, mock_jobtech, monkeypatch
):
    monkeypatch.setattr(jobtech, "occupation_groups", lambda field: [])
    monkeypatch.setattr(jobtech, "municipalities", lambda region: [])
    api_client.force_authenticate(user)
    api_client.get(
        SEARCH_URL,
        {
            "region": "CifL_Rzy_Mku",
            "municipality": "bogus-id",
            "field": "bogus-id",
            "group": "bogus-id",
            "remote": "true",
        },
    )
    sent = mock_jobtech[0]
    assert sent["region"] == "CifL_Rzy_Mku"
    assert "municipality" not in sent  # unknown id dropped
    assert "occupation-field" not in sent  # unknown id dropped
    assert "occupation-group" not in sent  # unknown id dropped
    assert sent["remote"] == "true"


def test_search_forwards_known_occupation_group(
    api_client, user, mock_jobtech, monkeypatch
):
    monkeypatch.setattr(
        jobtech,
        "occupation_groups",
        lambda field: [
            {
                "id": "DJh5_yyF_hEM",
                "label": "Mjukvaru- och systemutvecklare m.fl.",
                "field_id": field,
            }
        ],
    )
    api_client.force_authenticate(user)
    api_client.get(
        SEARCH_URL,
        {"field": "apaJ_2ja_LuF", "group": "DJh5_yyF_hEM"},
    )
    sent = mock_jobtech[0]
    assert "occupation-field" not in sent
    assert sent["occupation-group"] == "DJh5_yyF_hEM"


def test_search_forwards_known_municipality(
    api_client, user, mock_jobtech, monkeypatch
):
    monkeypatch.setattr(
        jobtech,
        "municipalities",
        lambda region: [
            {
                "id": "AvNB_uwa_6n6",
                "label": "Stockholm",
                "region_id": region,
            }
        ],
    )
    api_client.force_authenticate(user)
    api_client.get(
        SEARCH_URL,
        {"region": "CifL_Rzy_Mku", "municipality": "AvNB_uwa_6n6"},
    )
    sent = mock_jobtech[0]
    assert "region" not in sent
    assert sent["municipality"] == "AvNB_uwa_6n6"


def test_search_adds_cv_match(api_client, user, mock_jobtech):
    Resume.objects.create(user=user, skills=["Python", "Rust"])
    api_client.force_authenticate(user)
    body = api_client.get(SEARCH_URL, {"q": "python"}).json()
    assert body["results"][0]["match"]["count"] == 1
    assert body["results"][0]["match"]["matched"] == ["Python"]


def test_search_match_cv_filter(api_client, user, mock_jobtech):
    Resume.objects.create(user=user, skills=["Python", "Rust"])
    api_client.force_authenticate(user)
    body = api_client.get(SEARCH_URL, {"q": "python", "match_cv": "true"}).json()
    assert body["match_cv_filtered"] is True
    assert len(body["results"]) == 1
    assert body["results"][0]["match"]["matched"] == ["Python"]


def test_search_match_cv_requires_resume(api_client, user, mock_jobtech):
    api_client.force_authenticate(user)
    response = api_client.get(SEARCH_URL, {"match_cv": "true"})
    assert response.status_code == 400


def test_search_handles_upstream_failure(api_client, user, monkeypatch):
    def boom(url, params=None, timeout=None):
        raise requests.RequestException("down")

    monkeypatch.setattr(jobtech.requests, "get", boom)
    api_client.force_authenticate(user)
    response = api_client.get(SEARCH_URL, {"q": "python"})
    assert response.status_code == 502


def test_identical_searches_are_cached(api_client, user, mock_jobtech):
    api_client.force_authenticate(user)
    api_client.get(SEARCH_URL, {"q": "python"})
    api_client.get(SEARCH_URL, {"q": "python"})
    assert len(mock_jobtech) == 1  # second hit served from cache

    api_client.get(SEARCH_URL, {"q": "django"})
    assert len(mock_jobtech) == 2  # different query goes upstream


def test_cached_search_still_applies_cv_match(api_client, user, mock_jobtech):
    api_client.force_authenticate(user)
    api_client.get(SEARCH_URL, {"q": "python"})  # warm cache without resume

    Resume.objects.create(user=user, skills=["Python"])
    body = api_client.get(SEARCH_URL, {"q": "python"}).json()
    assert len(mock_jobtech) == 1
    assert body["results"][0]["match"]["matched"] == ["Python"]


# --- CV skill matching (regression guards for boundary-aware matching) ---


def _job(title="", description=""):
    return SimpleNamespace(title=title, description=description)


def test_match_does_not_substring_match_short_skill():
    """'Go' must not match inside 'Django'; only real Python matches."""
    result = match_skills(
        ["Go", "Python"], _job("Utvecklare", "Vi jobbar med Django och Python")
    )
    assert result["matched"] == ["Python"]
    assert result["count"] == 1


def test_match_multiword_phrase():
    result = match_skills(
        ["Power BI"], _job("Analytiker", "Erfarenhet av Power BI krävs")
    )
    assert result["matched"] == ["Power BI"]


def test_match_symbol_heavy_skill_csharp():
    result = match_skills(["C#"], _job("Utvecklare", "Vi kodar i C# och .NET"))
    assert result["matched"] == ["C#"]


def test_match_symbol_heavy_skills_cpp_and_dotnet():
    result = match_skills(
        ["C++", ".NET", "Node.js"],
        _job("Dev", "Stacken är C++, .NET och Node.js i produktion"),
    )
    assert set(result["matched"]) == {"C++", ".NET", "Node.js"}


def test_match_ignores_substrings_in_unrelated_words():
    # "AI" inside "Thailand", "R" inside "React" — neither should match.
    result = match_skills(
        ["AI", "R"], _job("Resekonsult", "Resor till Thailand med React-sajt")
    )
    assert result["matched"] == []


def test_match_is_case_insensitive_and_phrase_whitespace_flexible():
    result = match_skills(
        ["react native"], _job("Mobil", "Bygg appar i  React   Native dagligen")
    )
    assert result["matched"] == ["react native"]


def test_match_standalone_short_skill_is_found():
    result = match_skills(["Go", "R"], _job("Data", "Vi använder Go och R för analys."))
    assert set(result["matched"]) == {"Go", "R"}
