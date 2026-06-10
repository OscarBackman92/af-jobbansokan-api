import pytest
from core.identity import pseudonymize_personal_number
from core.models import ApplicantProfile, AuditLog, JobApplication
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/"

User = get_user_model()


def test_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


def test_get_shows_identity_and_employer_status(api_client, applicant):
    ApplicantProfile.objects.create(
        user=applicant,
        personal_number_hash=pseudonymize_personal_number("199001012384"),
    )
    api_client.force_authenticate(applicant)
    body = api_client.get(URL).json()

    assert body["username"] == "applicant"
    assert body["identity"]["verified"] is True
    assert body["identity"]["method"] == "bankid-mock"
    assert body["employer"] is None


def test_get_unverified_user(api_client, employer_admin):
    api_client.force_authenticate(employer_admin)
    body = api_client.get(URL).json()

    assert body["identity"] == {"verified": False}
    assert body["employer"] == {"organization": "Acme AB", "role": "admin"}


def test_patch_updates_contact_details(api_client, applicant):
    api_client.force_authenticate(applicant)
    response = api_client.patch(
        URL,
        {"email": "anna@example.com", "first_name": "Anna", "last_name": "Svensson"},
    )
    assert response.status_code == 200

    applicant.refresh_from_db()
    assert applicant.email == "anna@example.com"
    assert applicant.first_name == "Anna"


def test_patch_cannot_change_username(api_client, applicant):
    api_client.force_authenticate(applicant)
    response = api_client.patch(URL, {"username": "hacker"})
    assert response.status_code == 200  # read-only field silently ignored

    applicant.refresh_from_db()
    assert applicant.username == "applicant"


def test_delete_erases_account_and_logs(api_client, applicant, posting):
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )
    user_id = applicant.id
    api_client.force_authenticate(applicant)
    response = api_client.delete(URL)
    assert response.status_code == 204

    assert not User.objects.filter(id=user_id).exists()
    assert not JobApplication.objects.filter(owner_id=user_id).exists()

    # The audit entry survives, with the actor anonymized by SET_NULL.
    entry = AuditLog.objects.get(action=AuditLog.ACTION_ACCOUNT_DELETED)
    assert entry.actor is None
    assert entry.metadata["user_id"] == user_id
