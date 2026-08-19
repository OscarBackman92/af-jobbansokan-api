import pytest
from core.models import JobApplication
from datetime import timedelta
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
        "match_scope",
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
    assert len(body["next_actions"]) <= 8


def test_funnel_responded_excludes_no_response_and_withdrawn(api_client, user):
    today = timezone.localdate()
    for status in ("applied", "rejected", "no_response", "withdrawn"):
        JobApplication.objects.create(
            owner=user,
            company=status,
            title="Dev",
            status=status,
            applied_at=today,
        )
    api_client.force_authenticate(user)
    funnel = api_client.get(URL).json()["funnel"]
    assert funnel["applied"] == 4
    assert funnel["responded"] == 1


def test_waiting_and_fresh_match_waiting_age(api_client, user):
    today = timezone.localdate()
    JobApplication.objects.create(
        owner=user,
        company="Fresh",
        title="Dev",
        status="applied",
        applied_at=today - timedelta(days=2),
    )
    JobApplication.objects.create(
        owner=user,
        company="Late",
        title="Dev",
        status="applied",
        applied_at=today - timedelta(days=10),
    )
    JobApplication.objects.create(
        owner=user,
        company="Dialog",
        title="Dev",
        status="screening",
        applied_at=today - timedelta(days=3),
    )
    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    assert body["outcomes"]["fresh"] == 1
    assert body["outcomes"]["waiting"] == 1
    age = body["waiting_age"]
    assert sum(age.values()) == 2


def test_next_actions_lists_overdue_first(api_client, user):
    today = timezone.localdate()
    JobApplication.objects.create(
        owner=user,
        company="Länsstyrelsen",
        title="IT-handläggare",
        status="applied",
        applied_at=today,
        next_action_at=today - timedelta(days=8),
    )
    api_client.force_authenticate(user)
    rows = api_client.get(URL).json()["next_actions"]
    assert rows
    assert rows[0]["overdue"] is True
    assert "Försenad" in rows[0]["label"]
