import pytest
from core.models import AuditLog, EmployerProfile, JobApplication

pytestmark = pytest.mark.django_db

ORG_URL = "/api/v1/employer/organizations/"


def _status_url(application_id):
    return f"/api/v1/employer/applications/{application_id}/"


@pytest.fixture
def application(applicant, posting):
    return JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )


def test_employer_member_can_update_status(api_client, employer_member, application):
    api_client.force_authenticate(employer_member)
    response = api_client.patch(_status_url(application.id), {"status": "interview"})
    assert response.status_code == 200

    application.refresh_from_db()
    assert application.status == "interview"

    entry = AuditLog.objects.get(action=AuditLog.ACTION_STATUS_CHANGED)
    assert entry.actor == employer_member
    assert entry.metadata == {"from_status": "applied", "to_status": "interview"}
    assert entry.target_id == str(application.id)


def test_unchanged_status_is_not_audit_logged(api_client, employer_member, application):
    api_client.force_authenticate(employer_member)
    api_client.patch(_status_url(application.id), {"status": "applied"})
    assert not AuditLog.objects.filter(action=AuditLog.ACTION_STATUS_CHANGED).exists()


def test_invalid_status_rejected(api_client, employer_member, application):
    api_client.force_authenticate(employer_member)
    response = api_client.patch(_status_url(application.id), {"status": "hired!!"})
    assert response.status_code == 400


def test_other_org_application_is_invisible(
    api_client, employer_member, application, django_user_model
):
    from core.models import Organization

    other_org = Organization.objects.create(name="Other AB")
    outsider = django_user_model.objects.create_user(username="outsider", password="x")
    EmployerProfile.objects.create(user=outsider, organization=other_org, role="admin")

    api_client.force_authenticate(outsider)
    response = api_client.patch(_status_url(application.id), {"status": "interview"})
    assert response.status_code == 404


def test_applicant_cannot_update_status(api_client, applicant, application):
    api_client.force_authenticate(applicant)
    response = api_client.patch(_status_url(application.id), {"status": "offer"})
    assert response.status_code == 403


def test_user_can_create_organization_and_becomes_admin(api_client, applicant):
    api_client.force_authenticate(applicant)
    response = api_client.post(
        ORG_URL, {"name": "Nystartat AB", "org_number": "559999-0001"}
    )
    assert response.status_code == 201

    profile = EmployerProfile.objects.get(user=applicant)
    assert profile.organization.name == "Nystartat AB"
    assert profile.role == "admin"

    me = api_client.get("/api/v1/me/").json()
    assert me["employer"] == {"organization": "Nystartat AB", "role": "admin"}


def test_existing_employer_cannot_create_second_org(api_client, employer_admin):
    api_client.force_authenticate(employer_admin)
    response = api_client.post(ORG_URL, {"name": "Sidobolag AB"})
    assert response.status_code == 400


def test_org_creation_requires_auth(api_client):
    assert api_client.post(ORG_URL, {"name": "X"}).status_code == 401
