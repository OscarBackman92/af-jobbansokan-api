import pytest

pytestmark = pytest.mark.django_db

URL = "/api/v1/postings/"


def test_anyone_can_list_postings(api_client, posting):
    response = api_client.get(URL)
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [posting.id]


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
