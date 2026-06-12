import pytest
from core.models import JobPosting

pytestmark = pytest.mark.django_db

URL = "/api/v1/postings/"


def test_list_requires_auth(api_client, posting):
    assert api_client.get(URL).status_code == 401


def test_list_is_lean(api_client, user, posting):
    api_client.force_authenticate(user)
    response = api_client.get(URL)
    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["id"] for item in results] == [posting.id]
    # List payloads stay lean — full text only in the detail view.
    assert "description" not in results[0]


def test_detail_includes_description_and_link(api_client, user, posting):
    posting.description = "Lång annonstext här."
    posting.save()

    api_client.force_authenticate(user)
    response = api_client.get(f"{URL}{posting.id}/")
    assert response.status_code == 200
    body = response.json()
    assert body["description"] == "Lång annonstext här."
    assert body["webpage_url"] == "https://example.com/annons/1"


def test_postings_are_read_only(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(URL, {"title": "X", "company_name": "Y"})
    assert response.status_code == 405


def test_search_matches_across_fields(api_client, user):
    python_job = JobPosting.objects.create(
        title="Backendutvecklare",
        company_name="Acme AB",
        description="Vi arbetar med Python och Django.",
        location="Stockholm",
    )
    JobPosting.objects.create(
        title="Frontendutvecklare",
        company_name="Beta AB",
        description="React och TypeScript.",
        location="Göteborg",
    )

    api_client.force_authenticate(user)
    response = api_client.get(URL, {"search": "python"})
    assert [p["id"] for p in response.json()["results"]] == [python_job.id]

    # Multiple terms are ANDed together.
    response = api_client.get(URL, {"search": "python göteborg"})
    assert response.json()["count"] == 0


def test_location_filter(api_client, user):
    stockholm = JobPosting.objects.create(
        title="A", company_name="X", location="Stockholm"
    )
    JobPosting.objects.create(title="B", company_name="Y", location="Göteborg")

    api_client.force_authenticate(user)
    response = api_client.get(URL, {"location": "stockholm"})
    assert [p["id"] for p in response.json()["results"]] == [stockholm.id]
