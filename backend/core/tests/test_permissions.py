"""Tests for custom permission classes."""
import pytest

from core.models import JobApplication


@pytest.mark.django_db
def test_unauthenticated_cannot_create_application(api_client, posting):
    payload = {"posting": posting.id, "applied_at": "2024-03-01"}
    response = api_client.post("/api/v1/applications/", payload)
    assert response.status_code == 401


@pytest.mark.django_db
def test_unauthenticated_cannot_access_me(api_client):
    response = api_client.get("/api/v1/me/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_authenticated_applicant_cannot_access_employer_endpoint(applicant_client):
    response = applicant_client.get("/api/v1/employer/applications/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_employer_member_cannot_create_posting(employer_member_client):
    payload = {"title": "Dev", "company_name": "Corp"}
    response = employer_member_client.post("/api/v1/postings/", payload)
    assert response.status_code == 403


@pytest.mark.django_db
def test_employer_member_cannot_delete_posting(employer_member_client, posting):
    response = employer_member_client.delete(f"/api/v1/postings/{posting.id}/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_applicant_cannot_delete_other_users_application(
    applicant_client, employer_admin, posting
):
    app = JobApplication.objects.create(
        owner=employer_admin, posting=posting, applied_at="2024-03-01"
    )
    response = applicant_client.delete(f"/api/v1/applications/{app.id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_invalid_status_value_rejected(applicant_client, applicant, posting):
    app = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-01"
    )
    response = applicant_client.patch(
        f"/api/v1/applications/{app.id}/", {"status": "not_a_valid_status"}
    )
    assert response.status_code == 400
