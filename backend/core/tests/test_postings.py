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


def test_employer_admin_creates_for_own_org(api_client, employer_admin, organization):
    api_client.force_authenticate(employer_admin)
    response = api_client.post(
        URL, {"title": "Backend Developer", "company_name": "Acme AB"}
    )
    assert response.status_code == 201
    assert response.json()["organization"]["id"] == organization.id
