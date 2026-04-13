"""Tests for /api/v1/applications/ (applicant CRUD)."""
from datetime import date, timedelta

import pytest

from core.models import JobApplication, JobPosting


@pytest.mark.django_db
def test_list_applications_unauthenticated(api_client):
    response = api_client.get("/api/v1/applications/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_applications_empty(applicant_client):
    response = applicant_client.get("/api/v1/applications/")
    assert response.status_code == 200
    assert response.json()["results"] == []


@pytest.mark.django_db
def test_create_application(applicant_client, posting):
    payload = {"posting": posting.id, "applied_at": "2024-03-01"}
    response = applicant_client.post("/api/v1/applications/", payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "applied"
    assert data["posting_detail"]["id"] == posting.id
    assert data["posting_detail"]["title"] == "Software Engineer"


@pytest.mark.django_db
def test_create_application_future_date_rejected(applicant_client, posting):
    future = (date.today() + timedelta(days=1)).isoformat()
    payload = {"posting": posting.id, "applied_at": future}
    response = applicant_client.post("/api/v1/applications/", payload)
    assert response.status_code == 400
    assert "future" in str(response.json()).lower()


@pytest.mark.django_db
def test_applicant_can_update_status(applicant_client, posting, applicant):
    app = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-01", status="applied"
    )
    response = applicant_client.patch(f"/api/v1/applications/{app.id}/", {"status": "interview"})
    assert response.status_code == 200
    assert response.json()["status"] == "interview"


@pytest.mark.django_db
def test_applicant_cannot_update_other_users_application(
    applicant_client, posting, employer_admin
):
    other_app = JobApplication.objects.create(
        owner=employer_admin, posting=posting, applied_at="2024-03-01"
    )
    response = applicant_client.patch(
        f"/api/v1/applications/{other_app.id}/", {"status": "interview"}
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_applicant_only_sees_own_applications(applicant_client, applicant, posting, employer_admin):
    JobApplication.objects.create(owner=applicant, posting=posting, applied_at="2024-03-01")
    JobApplication.objects.create(owner=employer_admin, posting=posting, applied_at="2024-03-02")

    response = applicant_client.get("/api/v1/applications/")
    assert response.status_code == 200
    assert response.json()["count"] == 1


@pytest.mark.django_db
def test_delete_application(applicant_client, applicant, posting):
    app = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-01"
    )
    response = applicant_client.delete(f"/api/v1/applications/{app.id}/")
    assert response.status_code == 204
    assert not JobApplication.objects.filter(pk=app.id).exists()


@pytest.mark.django_db
def test_list_applications_paginated(applicant_client, applicant, posting):
    for i in range(25):
        JobApplication.objects.create(
            owner=applicant, posting=posting, applied_at=f"2024-01-{i + 1:02d}"
        )
    response = applicant_client.get("/api/v1/applications/")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 25
    assert len(data["results"]) == 20  # PAGE_SIZE


@pytest.mark.django_db
def test_applications_search_by_posting_title(applicant_client, applicant, org):
    p1 = JobPosting.objects.create(
        organization=org, title="Python Dev", company_name="A", source="manual"
    )
    p2 = JobPosting.objects.create(
        organization=org, title="Java Dev", company_name="B", source="manual"
    )
    JobApplication.objects.create(owner=applicant, posting=p1, applied_at="2024-03-01")
    JobApplication.objects.create(owner=applicant, posting=p2, applied_at="2024-03-02")

    response = applicant_client.get("/api/v1/applications/?search=Python")
    assert response.status_code == 200
    assert response.json()["count"] == 1
