from datetime import date, timedelta

import pytest
from core.models import JobApplication

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


def test_delete_own_row(api_client, user):
    application = JobApplication.objects.create(owner=user, company="Acme", title="Dev")
    api_client.force_authenticate(user)
    response = api_client.delete(f"{URL}{application.id}/")
    assert response.status_code == 204
    assert not JobApplication.objects.filter(id=application.id).exists()
