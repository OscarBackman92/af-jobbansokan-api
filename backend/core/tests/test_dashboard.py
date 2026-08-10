import pytest
from core.models import JobApplication
from django.utils import timezone

pytestmark = pytest.mark.django_db

URL = "/api/v1/dashboard/"


def test_dashboard_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


def test_dashboard_response_shape(api_client, user):
    today = timezone.localdate()
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="wishlist",
        apply_by=today,
        apply_by_is_auto=False,
        deadline=today,
    )
    JobApplication.objects.create(
        owner=user,
        company="Beta",
        title="Dev",
        status="applied",
        applied_at=today,
    )

    api_client.force_authenticate(user)
    response = api_client.get(URL)
    assert response.status_code == 200
    body = response.json()

    assert set(body) == {
        "kpis",
        "funnel",
        "next_actions",
        "monthly",
        "outcomes",
        "response_by_match",
        "top_companies",
        "waiting_age",
        "pace",
    }
    assert set(body["kpis"]) == {
        "to_apply",
        "urgent",
        "follow_up",
        "saved_total",
        "active_applications",
        "in_dialog",
        "offers",
    }
    assert set(body["funnel"]) == {
        "tracked",
        "applied",
        "responded",
        "in_dialog",
        "interview",
        "offer",
    }
    assert set(body["outcomes"]) == {
        "rejected",
        "no_response",
        "waiting",
        "fresh",
        "applied_total",
    }
    assert set(body["waiting_age"]) == {"d0_6", "d7_10", "d11_14", "d15_plus"}
    assert set(body["pace"]) >= {
        "applied_7d",
        "saved_7d",
        "save_apply_ratio",
        "median_days_saved_to_applied",
        "median_days_to_response",
        "followups_logged",
    }
    assert len(body["monthly"]) == 6
    assert len(body["response_by_match"]) == 2
    assert body["kpis"]["saved_total"] == 1
    assert body["kpis"]["active_applications"] == 1
    assert isinstance(body["next_actions"], list)
    assert len(body["next_actions"]) <= 5
