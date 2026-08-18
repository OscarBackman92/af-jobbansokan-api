from datetime import date, timedelta

import pytest
from core.lifecycle import (
    allowed_next_statuses,
    assert_transition_allowed,
    employer_key,
    is_overdue,
    stage_for_status,
)
from core.models import JobApplication
from django.core.exceptions import ValidationError
from django.utils import timezone

pytestmark = pytest.mark.django_db

URL = "/api/v1/applications/"


def test_employer_key_strips_company_form():
    assert employer_key("Järfälla Kommun AB") == "järfälla kommun"
    assert employer_key("Acme & Co") == "acme"


def test_applied_cannot_return_to_wishlist():
    assert "wishlist" not in allowed_next_statuses("applied")
    with pytest.raises(ValidationError):
        assert_transition_allowed("applied", "wishlist")


def test_wishlist_can_become_applied_or_closed():
    allowed = allowed_next_statuses("wishlist")
    assert "applied" in allowed
    assert "withdrawn" in allowed
    assert "interview" not in allowed


def test_closed_can_reopen_to_interview():
    assert_transition_allowed("rejected", "interview")


def test_offer_cannot_skip_back_to_applied():
    with pytest.raises(ValidationError):
        assert_transition_allowed("offer", "applied")


def test_migration_fills_stage_and_outcome(user):
    app = JobApplication.objects.create(
        owner=user, company="Acme AB", title="Dev", status="rejected"
    )
    app.refresh_from_db()
    assert app.stage == "avslutad"
    assert app.outcome == "avslag"
    assert app.employer_key == "acme"
    assert app.closed_at is not None


def test_bevakad_count_matches_wishlist(api_client, user):
    JobApplication.objects.create(
        owner=user, company="A", title="Dev", status="wishlist"
    )
    JobApplication.objects.create(
        owner=user, company="B", title="Dev", status="applied", applied_at=date.today()
    )
    api_client.force_authenticate(user)
    saved = JobApplication.objects.filter(owner=user, stage="bevakad").count()
    dash = api_client.get("/api/v1/dashboard/").json()
    assert saved == 1
    assert dash["kpis"]["saved_total"] == saved


def test_patch_rejects_illegal_transition(api_client, user):
    application = JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date.today(),
    )
    api_client.force_authenticate(user)
    response = api_client.patch(f"{URL}{application.id}/", {"status": "wishlist"})
    assert response.status_code == 400


def test_list_includes_allowed_next_statuses(api_client, user):
    JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date.today(),
    )
    api_client.force_authenticate(user)
    row = api_client.get(URL).json()["results"][0]
    assert row["stage"] == "sokt"
    assert "wishlist" not in row["allowed_next_statuses"]
    assert "interview" in row["allowed_next_statuses"]


def test_closed_rows_always_have_outcome(user):
    for status, outcome in (
        ("accepted", "tackade_ja"),
        ("rejected", "avslag"),
        ("no_response", "inget_svar"),
        ("withdrawn", "aterkallad"),
    ):
        app = JobApplication.objects.create(
            owner=user, company="Acme", title=status, status=status
        )
        assert app.stage == "avslutad"
        assert app.outcome == outcome
        assert app.applied_at is not None


def test_non_bevakad_stamps_applied_at(user):
    app = JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", status="applied"
    )
    assert app.applied_at is not None


def test_wishlist_does_not_stamp_applied_at(user):
    app = JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", status="wishlist"
    )
    assert app.applied_at is None
    assert app.stage == "bevakad"


@pytest.mark.parametrize(
    "from_status,to_status",
    [
        ("wishlist", "interview"),
        ("wishlist", "screening"),
        ("wishlist", "offer"),
        ("applied", "wishlist"),
        ("screening", "wishlist"),
        ("screening", "applied"),
        ("interview", "wishlist"),
        ("interview", "applied"),
        ("offer", "wishlist"),
        ("offer", "applied"),
        ("offer", "interview"),
        ("rejected", "wishlist"),
        ("accepted", "wishlist"),
    ],
)
def test_illegal_stage_jumps(from_status, to_status):
    with pytest.raises(ValidationError):
        assert_transition_allowed(from_status, to_status)


def test_is_overdue_only_for_sought_stage(user):
    old = timezone.localdate() - timedelta(days=10)
    late = JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=old,
    )
    dialog = JobApplication.objects.create(
        owner=user,
        company="Beta",
        title="Dev",
        status="interview",
        applied_at=old,
    )
    assert is_overdue(late) is True
    assert is_overdue(dialog) is False
    assert stage_for_status("interview") == "intervju"
