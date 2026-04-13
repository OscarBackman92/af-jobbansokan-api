"""Tests for employer-specific endpoints."""
import pytest

from core.models import JobApplication, JobPosting, Organization, EmployerProfile


@pytest.mark.django_db
def test_employer_applications_unauthenticated(api_client):
    response = api_client.get("/api/v1/employer/applications/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_employer_applications_regular_user_forbidden(applicant_client):
    response = applicant_client.get("/api/v1/employer/applications/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_employer_sees_applications_for_own_org(employer_admin_client, applicant, posting):
    JobApplication.objects.create(owner=applicant, posting=posting, applied_at="2024-03-01")
    response = employer_admin_client.get("/api/v1/employer/applications/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["owner"]["username"] == "applicant"


@pytest.mark.django_db
def test_employer_does_not_see_other_orgs_applications(
    employer_admin_client, applicant, db
):
    other_org = Organization.objects.create(name="Other Corp", org_number="556999-0001")
    other_posting = JobPosting.objects.create(
        organization=other_org, title="Other Job", company_name="Other Corp", source="manual"
    )
    JobApplication.objects.create(owner=applicant, posting=other_posting, applied_at="2024-03-01")

    response = employer_admin_client.get("/api/v1/employer/applications/")
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.django_db
def test_employer_filter_applications_by_status(employer_admin_client, applicant, posting):
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-01", status="applied"
    )
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-02", status="interview"
    )
    response = employer_admin_client.get("/api/v1/employer/applications/?status=interview")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "interview"


@pytest.mark.django_db
def test_employer_update_application_status(employer_admin_client, applicant, posting):
    app = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-01", status="applied"
    )
    response = employer_admin_client.patch(
        f"/api/v1/employer/applications/{app.id}/", {"status": "interview"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "interview"
    app.refresh_from_db()
    assert app.status == "interview"


@pytest.mark.django_db
def test_employer_cannot_update_other_orgs_application(
    employer_admin_client, applicant, db
):
    other_org = Organization.objects.create(name="Other Corp", org_number="556999-0002")
    other_posting = JobPosting.objects.create(
        organization=other_org, title="Other Job", company_name="Other Corp", source="manual"
    )
    app = JobApplication.objects.create(
        owner=applicant, posting=other_posting, applied_at="2024-03-01"
    )
    response = employer_admin_client.patch(
        f"/api/v1/employer/applications/{app.id}/", {"status": "rejected"}
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_employer_member_can_view_applications(employer_member_client, applicant, posting):
    JobApplication.objects.create(owner=applicant, posting=posting, applied_at="2024-03-01")
    response = employer_member_client.get("/api/v1/employer/applications/")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.django_db
def test_employer_member_can_update_status(employer_member_client, applicant, posting):
    app = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2024-03-01", status="applied"
    )
    response = employer_member_client.patch(
        f"/api/v1/employer/applications/{app.id}/", {"status": "offer"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "offer"
