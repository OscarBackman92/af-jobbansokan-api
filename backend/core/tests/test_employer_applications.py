import pytest
from core.models import AuditLog, JobApplication, JobPosting, Organization

pytestmark = pytest.mark.django_db

URL = "/api/v1/employer/applications/"


def test_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


def test_requires_employer_profile(api_client, applicant):
    api_client.force_authenticate(applicant)
    assert api_client.get(URL).status_code == 403


def test_lists_only_own_org_and_logs_disclosure(
    api_client, employer_member, applicant, posting, organization
):
    other_org = Organization.objects.create(name="Other AB")
    other_posting = JobPosting.objects.create(
        organization=other_org, title="Other", company_name="Other AB"
    )
    visible = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )
    JobApplication.objects.create(
        owner=applicant, posting=other_posting, applied_at="2026-06-01"
    )

    api_client.force_authenticate(employer_member)
    response = api_client.get(URL)
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [visible.id]

    entry = AuditLog.objects.get(action=AuditLog.ACTION_APPLICATIONS_DISCLOSED)
    assert entry.actor == employer_member
    assert entry.metadata == {
        "organization_id": organization.id,
        "application_count": 1,
    }
