from datetime import date, timedelta

import pytest
from core.models import JobApplication
from django.utils import timezone

pytestmark = pytest.mark.django_db

URL = "/api/v1/applications/"


def test_create_requires_auth(api_client):
    response = api_client.post(URL, {"company": "Acme", "title": "Dev"})
    assert response.status_code == 401


def test_create_free_text_row(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "company": "Acme AB",
            "title": "Backendutvecklare",
            "status": "applied",
            "applied_at": "2026-06-01",
            "contact_name": "Rekryterare Rita",
            "notes": "Hittade annonsen på LinkedIn.",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["company"] == "Acme AB"
    assert body["status_label"] == "Ansökt"


def test_create_from_posting_snapshots_fields(api_client, user, posting):
    api_client.force_authenticate(user)
    response = api_client.post(URL, {"posting": posting.id, "applied_at": "2026-06-01"})
    assert response.status_code == 201
    body = response.json()
    assert body["company"] == "Acme AB"
    assert body["title"] == "Backend Developer"
    assert body["location"] == "Stockholm"
    assert body["ad_url"] == "https://example.com/annons/1"


def test_create_with_platsbanken_snapshot(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "company": "Tillväxtverket",
            "title": "Webbspecialist",
            "ad_url": "https://arbetsformedlingen.se/platsbanken/annonser/31258362",
            "apply_url": "https://tillvaxtverket.se/ledigajobb?rmjob=2046",
            "ad_description": "Du driver webbstrategi.",
            "source_job_id": "31258362",
            "status": "wishlist",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["apply_url"] == "https://tillvaxtverket.se/ledigajobb?rmjob=2046"
    assert body["ad_description"] == "Du driver webbstrategi."
    assert body["source_job_id"] == "31258362"


def test_create_without_posting_requires_company_and_title(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(URL, {"status": "applied"})
    assert response.status_code == 400


def test_cannot_track_same_posting_twice(api_client, user, posting):
    JobApplication.objects.create(
        owner=user, posting=posting, company="Acme AB", title="Backend Developer"
    )
    api_client.force_authenticate(user)
    response = api_client.post(URL, {"posting": posting.id})
    assert response.status_code == 400
    assert "posting" in response.json()


def test_cannot_track_same_live_ad_url_twice(api_client, user):
    JobApplication.objects.create(
        owner=user,
        company="Acme AB",
        title="Backend Developer",
        ad_url="https://arbetsformedlingen.se/annons/1001",
    )
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "company": "Acme AB",
            "title": "Backend Developer",
            "ad_url": "https://arbetsformedlingen.se/annons/1001",
        },
    )
    assert response.status_code == 400
    assert "ad_url" in response.json()


def test_cannot_track_same_ad_url_with_trailing_slash(api_client, user):
    JobApplication.objects.create(
        owner=user,
        company="Acme AB",
        title="Backend Developer",
        ad_url="https://arbetsformedlingen.se/annons/1001",
    )
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "company": "Acme AB",
            "title": "Backend Developer",
            "ad_url": "http://arbetsformedlingen.se/annons/1001/?utm_source=mail",
        },
    )
    assert response.status_code == 400
    assert "ad_url" in response.json()


def test_create_normalizes_ad_url(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "company": "Acme AB",
            "title": "Backend Developer",
            "ad_url": "http://Example.com/jobb/42/?utm_campaign=x",
        },
    )
    assert response.status_code == 201
    assert response.json()["ad_url"] == "https://example.com/jobb/42"


def test_applied_at_cannot_be_in_the_future(api_client, user):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    api_client.force_authenticate(user)
    response = api_client.post(
        URL, {"company": "Acme", "title": "Dev", "applied_at": tomorrow}
    )
    assert response.status_code == 400
    assert "applied_at" in response.json()


def test_list_returns_only_own_rows(api_client, user, django_user_model):
    other = django_user_model.objects.create_user(username="other", password="x")
    JobApplication.objects.create(owner=other, company="X", title="Y")
    mine = JobApplication.objects.create(owner=user, company="Acme", title="Dev")

    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    assert body["count"] == 1
    assert [item["id"] for item in body["results"]] == [mine.id]


def test_list_includes_cv_match_when_resume_has_skills(api_client, user, posting):
    from core.models import Resume

    Resume.objects.create(user=user, skills=["Python", "Django"])
    JobApplication.objects.create(
        owner=user,
        posting=posting,
        company=posting.company_name,
        title=posting.title,
        notes="Python backend role",
    )
    JobApplication.objects.create(owner=user, company="Other", title="Säljare")

    api_client.force_authenticate(user)
    rows = api_client.get(URL).json()["results"]
    by_title = {row["title"]: row for row in rows}
    assert by_title["Backend Developer"]["match"]["matched"] == ["Python"]
    assert by_title["Säljare"]["match"]["count"] == 0


def test_list_is_lean_but_detail_includes_events(api_client, user):
    application = JobApplication.objects.create(owner=user, company="Acme", title="Dev")
    application.events.create(occurred_at="2026-06-01", note="Samtal")

    api_client.force_authenticate(user)
    row = api_client.get(URL).json()["results"][0]
    assert "events" not in row
    assert row["status_label"]

    detail = api_client.get(f"{URL}{application.id}/").json()
    assert len(detail["events"]) == 1
    assert detail["events"][0]["note"] == "Samtal"


def test_list_respects_page_size_param(api_client, user):
    for i in range(25):
        JobApplication.objects.create(owner=user, company=f"C{i}", title="Dev")

    api_client.force_authenticate(user)
    body = api_client.get(URL, {"page_size": 200}).json()
    assert body["count"] == 25
    assert len(body["results"]) == 25
    assert body["next"] is None


def test_tracked_urls_lists_own_ad_urls_only(api_client, user, django_user_model):
    other = django_user_model.objects.create_user(username="other", password="x")
    JobApplication.objects.create(
        owner=other, company="X", title="Y", ad_url="https://example.com/other"
    )
    JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", ad_url="https://example.com/mine"
    )
    JobApplication.objects.create(owner=user, company="NoUrl", title="Dev")

    api_client.force_authenticate(user)
    body = api_client.get(f"{URL}tracked-urls/").json()
    assert body["urls"] == ["https://example.com/mine"]


def test_tracked_urls_requires_auth(api_client):
    assert api_client.get(f"{URL}tracked-urls/").status_code == 401


def test_status_update_appends_timeline_event(api_client, user):
    application = JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", status="applied"
    )
    api_client.force_authenticate(user)
    response = api_client.patch(f"{URL}{application.id}/", {"status": "interview"})
    assert response.status_code == 200

    events = application.events.all()
    assert len(events) == 1
    assert events[0].status == "interview"
    assert "Intervju" in events[0].note


def test_status_to_applied_sets_applied_at(api_client, user):
    application = JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", status="wishlist"
    )
    assert application.applied_at is None

    api_client.force_authenticate(user)
    response = api_client.patch(f"{URL}{application.id}/", {"status": "applied"})
    assert response.status_code == 200

    application.refresh_from_db()
    assert application.status == "applied"
    assert application.applied_at == timezone.localdate()
    assert application.events.count() == 1


def test_status_to_applied_keeps_existing_applied_at(api_client, user):
    application = JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="wishlist",
        applied_at=date(2026, 6, 1),
    )
    api_client.force_authenticate(user)
    api_client.patch(f"{URL}{application.id}/", {"status": "applied"})
    application.refresh_from_db()
    assert str(application.applied_at) == "2026-06-01"


def test_list_includes_last_activity_at(api_client, user):
    application = JobApplication.objects.create(
        owner=user,
        company="Acme",
        title="Dev",
        status="applied",
        applied_at=date(2026, 6, 1),
    )
    application.events.create(occurred_at=date(2026, 6, 10), note="Ping")

    api_client.force_authenticate(user)
    row = api_client.get(URL).json()["results"][0]
    assert row["last_activity_at"] == "2026-06-10"


def test_row_is_editable(api_client, user):
    application = JobApplication.objects.create(owner=user, company="Acme", title="Dev")
    api_client.force_authenticate(user)
    response = api_client.patch(
        f"{URL}{application.id}/",
        {"notes": "Ringde rekryteraren.", "next_action_at": "2026-06-20"},
    )
    assert response.status_code == 200
    application.refresh_from_db()
    assert application.notes == "Ringde rekryteraren."
    assert str(application.next_action_at) == "2026-06-20"


def test_add_manual_timeline_event(api_client, user):
    application = JobApplication.objects.create(owner=user, company="Acme", title="Dev")
    api_client.force_authenticate(user)
    response = api_client.post(
        f"{URL}{application.id}/events/",
        {"occurred_at": "2026-06-10", "note": "Telefonintervju med rekryterare."},
    )
    assert response.status_code == 201
    assert application.events.count() == 1


def test_cannot_touch_others_rows(api_client, user, django_user_model):
    other = django_user_model.objects.create_user(username="other", password="x")
    application = JobApplication.objects.create(owner=other, company="X", title="Y")
    api_client.force_authenticate(user)
    assert api_client.get(f"{URL}{application.id}/").status_code == 404
    assert (
        api_client.patch(f"{URL}{application.id}/", {"status": "offer"}).status_code
        == 404
    )


def test_filter_by_status_and_search(api_client, user):
    JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", status="interview"
    )
    JobApplication.objects.create(
        owner=user, company="Beta", title="Dev", status="applied"
    )

    api_client.force_authenticate(user)
    body = api_client.get(URL, {"status": "interview"}).json()
    assert body["count"] == 1
    assert body["results"][0]["company"] == "Acme"

    body = api_client.get(URL, {"search": "beta"}).json()
    assert body["count"] == 1
    assert body["results"][0]["company"] == "Beta"


def test_export_csv(api_client, user):
    JobApplication.objects.create(
        owner=user, company="=cmd", title="Dev", status="applied"
    )
    api_client.force_authenticate(user)
    response = api_client.get(f"{URL}export/")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    content = response.content.decode("utf-8-sig")
    assert "'=cmd" in content
    assert "Dev" in content
    assert "intent" in content.splitlines()[0]
    assert "apply_by" in content.splitlines()[0]


def test_wishlist_create_sets_auto_apply_by(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {"company": "Acme", "title": "Dev", "status": "wishlist"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["apply_by"] == str(
        timezone.localdate() + timedelta(days=JobApplication.AUTO_APPLY_BY_DAYS)
    )
    assert body["apply_by_is_auto"] is True


def test_wishlist_create_uses_deadline_as_apply_by(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "company": "Acme",
            "title": "Dev",
            "status": "wishlist",
            "deadline": "2026-09-01",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["apply_by"] == "2026-09-01"
    assert body["apply_by_is_auto"] is False


def test_archived_hidden_from_default_list_but_in_tracked_urls(api_client, user):
    active = JobApplication.objects.create(
        owner=user,
        company="Active",
        title="Dev",
        ad_url="https://example.com/active",
    )
    archived = JobApplication.objects.create(
        owner=user,
        company="Archived",
        title="Dev",
        ad_url="https://example.com/archived",
        archived_at=timezone.now(),
    )
    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    ids = {row["id"] for row in body["results"]}
    assert active.id in ids
    assert archived.id not in ids

    archived_body = api_client.get(URL, {"archived": "1"}).json()
    archived_ids = {row["id"] for row in archived_body["results"]}
    assert archived.id in archived_ids
    assert active.id not in archived_ids

    tracked = api_client.get(f"{URL}tracked-urls/").json()["urls"]
    assert "https://example.com/active" in tracked
    assert "https://example.com/archived" in tracked


def test_bulk_rejects_other_users_ids(api_client, user, django_user_model):
    other = django_user_model.objects.create_user(username="other", password="x")
    own = JobApplication.objects.create(
        owner=user, company="Mine", title="Dev", status="wishlist"
    )
    foreign = JobApplication.objects.create(
        owner=other, company="Theirs", title="Dev", status="wishlist"
    )
    api_client.force_authenticate(user)
    response = api_client.post(
        f"{URL}bulk/",
        {"ids": [own.id, foreign.id], "action": "archive"},
        format="json",
    )
    assert response.status_code == 400
    assert "ids" in response.json()
    own.refresh_from_db()
    assert own.archived_at is None


def test_bulk_mark_applied_is_idempotent_and_logs_event(api_client, user):
    application = JobApplication.objects.create(
        owner=user, company="Acme", title="Dev", status="wishlist"
    )
    api_client.force_authenticate(user)
    response = api_client.post(
        f"{URL}bulk/",
        {"ids": [application.id], "action": "mark_applied", "date": "2026-08-01"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["updated"] == [application.id]
    application.refresh_from_db()
    assert application.status == "applied"
    assert str(application.applied_at) == "2026-08-01"
    assert application.events.count() == 1

    again = api_client.post(
        f"{URL}bulk/",
        {"ids": [application.id], "action": "mark_applied"},
        format="json",
    )
    assert again.status_code == 200
    assert again.json()["updated"] == [application.id]
    application.refresh_from_db()
    assert application.events.count() == 1


def test_saved_summary_shape(api_client, user):
    today = timezone.localdate()
    JobApplication.objects.create(
        owner=user,
        company="Urgent",
        title="Dev",
        status="wishlist",
        deadline=today + timedelta(days=3),
        apply_by=today + timedelta(days=3),
        apply_by_is_auto=False,
    )
    JobApplication.objects.create(
        owner=user,
        company="Auto",
        title="Dev",
        status="wishlist",
        apply_by=today + timedelta(days=10),
        apply_by_is_auto=True,
    )
    JobApplication.objects.create(
        owner=user,
        company="Paused",
        title="Dev",
        status="wishlist",
        intent="paused",
        apply_by=today + timedelta(days=2),
        apply_by_is_auto=False,
        deadline=today + timedelta(days=2),
    )
    JobApplication.objects.create(
        owner=user, company="Applied", title="Dev", status="applied"
    )

    api_client.force_authenticate(user)
    body = api_client.get(f"{URL}saved-summary/").json()
    assert set(body) == {
        "total",
        "urgent",
        "this_month",
        "no_deadline",
        "paused",
        "expired",
    }
    assert body["total"] == 3
    assert body["urgent"] == 1
    assert body["no_deadline"] == 1
    assert body["paused"] == 1
    assert body["expired"] == 0
    assert body["this_month"] == 0


def test_migration_backfill_apply_by(user):
    import importlib.util
    from pathlib import Path

    from django.apps import apps

    path = (
        Path(__file__).resolve().parents[1]
        / "migrations"
        / "0016_jobapplication_apply_by_intent_archived.py"
    )
    spec = importlib.util.spec_from_file_location("migration_0016", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    with_deadline = JobApplication.objects.create(
        owner=user,
        company="Dead",
        title="Dev",
        status="wishlist",
        deadline=date(2026, 9, 1),
    )
    # Clear auto-set fields so backfill has work to do.
    JobApplication.objects.filter(id=with_deadline.id).update(
        apply_by=None, apply_by_is_auto=True
    )
    without = JobApplication.objects.create(
        owner=user, company="Auto", title="Dev", status="wishlist"
    )
    JobApplication.objects.filter(id=without.id).update(
        apply_by=None, apply_by_is_auto=True
    )
    applied = JobApplication.objects.create(
        owner=user, company="Applied", title="Dev", status="applied"
    )

    module.backfill_apply_by(apps, None)

    with_deadline.refresh_from_db()
    without.refresh_from_db()
    applied.refresh_from_db()
    assert with_deadline.apply_by == date(2026, 9, 1)
    assert with_deadline.apply_by_is_auto is False
    assert without.apply_by == (
        timezone.localtime(without.created_at).date() + timedelta(days=14)
    )
    assert without.apply_by_is_auto is True
    assert applied.apply_by is None

    module.clear_apply_by(apps, None)
    with_deadline.refresh_from_db()
    assert with_deadline.apply_by is None


def test_delete_own_row(api_client, user):
    application = JobApplication.objects.create(owner=user, company="Acme", title="Dev")
    api_client.force_authenticate(user)
    response = api_client.delete(f"{URL}{application.id}/")
    assert response.status_code == 204
    assert not JobApplication.objects.filter(id=application.id).exists()
