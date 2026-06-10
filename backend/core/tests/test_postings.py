import pytest

pytestmark = pytest.mark.django_db

URL = "/api/v1/postings/"


def test_anyone_can_list_postings(api_client, posting):
    response = api_client.get(URL)
    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["id"] for item in results] == [posting.id]
    # List payloads stay lean — full text only in the detail view.
    assert "description" not in results[0]


def test_detail_includes_description_and_link(api_client, posting):
    posting.description = "Lång annonstext här."
    posting.webpage_url = "https://example.com/annons/1"
    posting.save()

    response = api_client.get(f"{URL}{posting.id}/")
    assert response.status_code == 200
    body = response.json()
    assert body["description"] == "Lång annonstext här."
    assert body["webpage_url"] == "https://example.com/annons/1"


def test_non_employer_cannot_create(api_client, applicant):
    api_client.force_authenticate(applicant)
    response = api_client.post(URL, {"title": "X", "company_name": "Y"})
    assert response.status_code == 403


def test_employer_member_cannot_create(api_client, employer_member):
    api_client.force_authenticate(employer_member)
    response = api_client.post(URL, {"title": "X", "company_name": "Y"})
    assert response.status_code == 403


def test_search_matches_across_fields(api_client, organization):
    from core.models import JobPosting

    python_job = JobPosting.objects.create(
        organization=organization,
        title="Backendutvecklare",
        company_name="Acme AB",
        description="Vi arbetar med Python och Django.",
        location="Stockholm",
    )
    JobPosting.objects.create(
        organization=organization,
        title="Frontendutvecklare",
        company_name="Beta AB",
        description="React och TypeScript.",
        location="Göteborg",
    )

    response = api_client.get(URL, {"search": "python"})
    assert [p["id"] for p in response.json()["results"]] == [python_job.id]

    # Multiple terms are ANDed together.
    response = api_client.get(URL, {"search": "python göteborg"})
    assert response.json()["count"] == 0


def test_location_and_source_filters(api_client, organization):
    from core.models import JobPosting

    stockholm = JobPosting.objects.create(
        organization=organization,
        title="A",
        company_name="X",
        location="Stockholm",
        source="jobtech",
        external_id="j1",
    )
    JobPosting.objects.create(
        organization=organization,
        title="B",
        company_name="Y",
        location="Göteborg",
    )

    response = api_client.get(URL, {"location": "stockholm"})
    assert [p["id"] for p in response.json()["results"]] == [stockholm.id]

    response = api_client.get(URL, {"source": "jobtech"})
    assert [p["id"] for p in response.json()["results"]] == [stockholm.id]


def test_employer_admin_creates_for_own_org(api_client, employer_admin, organization):
    api_client.force_authenticate(employer_admin)
    response = api_client.post(
        URL, {"title": "Backend Developer", "company_name": "Acme AB"}
    )
    assert response.status_code == 201
    assert response.json()["organization"]["id"] == organization.id
