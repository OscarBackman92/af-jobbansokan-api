from datetime import date

import pytest
from core.models import JobApplication
from core.similar import find_similar_applications, titles_similar

pytestmark = pytest.mark.django_db


def test_titles_similar_contains_and_ratio():
    assert titles_similar("Handläggare", "Handläggare ekonomi")
    assert not titles_similar("Koks", "Systemutvecklare")


def test_jarfalla_jan_and_aug_are_flagged(user):
    JobApplication.objects.create(
        owner=user,
        company="Järfälla Kommun AB",
        title="Handläggare",
        status="applied",
        applied_at=date(2026, 1, 8),
    )
    matches = find_similar_applications(
        user,
        company="JÄRFÄLLA KOMMUN",
        title="Handläggare ekonomi",
    )
    assert len(matches) == 1
    assert matches[0].applied_at == date(2026, 1, 8)


def test_similar_endpoint_returns_notice_payload(api_client, user):
    JobApplication.objects.create(
        owner=user,
        company="Järfälla Kommun AB",
        title="Handläggare",
        status="applied",
        applied_at=date(2026, 1, 8),
    )
    api_client.force_authenticate(user)
    response = api_client.get(
        "/api/v1/applications/similar/",
        {"company": "JÄRFÄLLA KOMMUN", "title": "Handläggare"},
    )
    assert response.status_code == 200
    rows = response.json()["results"]
    assert rows[0]["company"] == "Järfälla Kommun AB"
    assert rows[0]["applied_at"] == "2026-01-08"
