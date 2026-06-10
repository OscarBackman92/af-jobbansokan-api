from datetime import date, timedelta

import pytest
from core.models import AuditLog, JobApplication, JobPosting

pytestmark = pytest.mark.django_db

URL = "/api/v1/applications/"


def _make_posting(organization, title):
    return JobPosting.objects.create(
        organization=organization, title=title, company_name=organization.name
    )


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


def test_cannot_apply_twice_to_same_posting(api_client, applicant, posting):
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-01"
    )
    api_client.force_authenticate(applicant)
    response = api_client.post(URL, {"posting": posting.id, "applied_at": "2026-06-02"})
    assert response.status_code == 400
    assert "posting" in response.json()


def test_applied_at_cannot_be_in_the_future(api_client, applicant, posting):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    api_client.force_authenticate(applicant)
    response = api_client.post(URL, {"posting": posting.id, "applied_at": tomorrow})
    assert response.status_code == 400
    assert "applied_at" in response.json()


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
    body = response.json()
    assert body["count"] == 1
    assert [item["id"] for item in body["results"]] == [mine.id]


def test_list_is_paginated(api_client, applicant, organization):
    for i in range(25):
        JobApplication.objects.create(
            owner=applicant,
            posting=_make_posting(organization, f"Job {i}"),
            applied_at="2026-06-01",
        )

    api_client.force_authenticate(applicant)
    body = api_client.get(URL).json()
    assert body["count"] == 25
    assert len(body["results"]) == 20
    assert body["next"] is not None

    page2 = api_client.get(URL, {"page": 2}).json()
    assert len(page2["results"]) == 5


def test_list_filters_by_date_range(api_client, applicant, organization):
    dates = ["2026-05-01", "2026-06-01", "2026-07-01"]
    applications = [
        JobApplication.objects.create(
            owner=applicant,
            posting=_make_posting(organization, f"Job {applied}"),
            applied_at=applied,
        )
        for applied in dates
    ]

    api_client.force_authenticate(applicant)
    response = api_client.get(URL, {"from": "2026-05-15", "to": "2026-06-15"})
    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["id"] for item in results] == [applications[1].id]


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
