import pytest
from core.models import AuditLog, JobApplication

pytestmark = pytest.mark.django_db

URL = "/api/v1/applications/"


def test_create_requires_auth(api_client, posting):
    response = api_client.post(URL, {"posting": posting.id, "applied_at": "2026-06-01"})
    assert response.status_code == 401


def test_create_logs_audit_entry(api_client, applicant, posting):
    api_client.force_authenticate(applicant)
    response = api_client.post(URL, {"posting": posting.id, "applied_at": "2026-06-01"})
    assert response.status_code == 201

    entry = AuditLog.objects.get(action=AuditLog.ACTION_APPLICATION_CREATED)
    assert entry.actor == applicant
    assert entry.target_type == "JobApplication"
    assert entry.target_id == str(response.json()["id"])
    assert entry.metadata == {"posting_id": posting.id}


def test_list_returns_only_own_applications(
    api_client, applicant, posting, django_user_model
):
    other = django_user_model.objects.create_user(username="other", password="x")
    JobApplication.objects.create(owner=other, posting=posting, applied_at="2026-06-01")
    mine = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-02"
    )

    api_client.force_authenticate(applicant)
    response = api_client.get(URL)
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [mine.id]


def test_list_filters_by_date_range(api_client, applicant, posting):
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-05-01"
    )
    mid = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-07-01"
    )

    api_client.force_authenticate(applicant)
    response = api_client.get(URL, {"from": "2026-05-15", "to": "2026-06-15"})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [mid.id]


def test_list_rejects_invalid_date(api_client, applicant):
    api_client.force_authenticate(applicant)
    response = api_client.get(URL, {"from": "not-a-date"})
    assert response.status_code == 400


def test_applications_are_immutable(api_client, applicant, posting):
    application = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )
    api_client.force_authenticate(applicant)
    detail_url = f"{URL}{application.id}/"

    patch = api_client.patch(detail_url, {"applied_at": "2026-06-02"})
    put = api_client.put(
        detail_url, {"posting": posting.id, "applied_at": "2026-06-02"}
    )
    assert patch.status_code == 405
    assert put.status_code == 405


def test_delete_logs_audit_entry(api_client, applicant, posting):
    application = JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )
    api_client.force_authenticate(applicant)
    response = api_client.delete(f"{URL}{application.id}/")
    assert response.status_code == 204
    assert not JobApplication.objects.filter(id=application.id).exists()

    entry = AuditLog.objects.get(action=AuditLog.ACTION_APPLICATION_DELETED)
    assert entry.actor == applicant
    assert entry.target_id == str(application.id)
