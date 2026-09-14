from allauth.account.models import EmailAddress
from core.admin_dashboard import dashboard_callback
from core.models import JobApplication
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
import pytest

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        "ops",
        "ops@example.com",
        "Testpass123!",
    )


@pytest.fixture
def admin_client(client, superuser):
    client.force_login(superuser)
    return client


def test_admin_login_page_renders(client):
    response = client.get("/admin/login/")
    assert response.status_code == 200
    assert b"Jobbdjungeln" in response.content


def test_anonymous_admin_index_redirects(client):
    response = client.get("/admin/")
    assert response.status_code == 302
    assert "/admin/login/" in response["Location"]


def test_dashboard_shows_kpis(admin_client, user):
    JobApplication.objects.create(
        owner=user,
        company="Acme AB",
        title="Backend",
        status=JobApplication.STATUS_APPLIED,
        applied_at=timezone.localdate(),
    )
    response = admin_client.get("/admin/")
    assert response.status_code == 200
    body = response.content.decode()
    assert "Översikt" in body
    assert "Användare" in body
    assert "Ansökningar" in body
    assert "Acme AB" in body
    assert "Försenad uppföljning" in body


def test_dashboard_callback_counts_users_and_apps(user, superuser):
    JobApplication.objects.create(
        owner=user,
        company="Beta",
        title="Utvecklare",
        status=JobApplication.STATUS_WISHLIST,
    )
    EmailAddress.objects.create(
        user=superuser,
        email=superuser.email,
        verified=False,
        primary=True,
    )
    context = dashboard_callback(request=None, context={})
    labels = {card["label"]: card["value"] for card in context["kpis"]}
    assert labels["Användare"] >= 2
    assert labels["Ansökningar"] == 1
    assert labels["Overifierade mejl"] >= 1
    wishlist = next(row for row in context["status_counts"] if row["key"] == "wishlist")
    assert wishlist["count"] == 1


def test_application_changelist_and_search(admin_client, user):
    JobApplication.objects.create(
        owner=user,
        company="Gamma Konsult",
        title="Projektledare",
        status=JobApplication.STATUS_INTERVIEW,
        applied_at=timezone.localdate(),
    )
    url = reverse("admin:core_jobapplication_changelist")
    response = admin_client.get(url)
    assert response.status_code == 200
    assert b"Gamma Konsult" in response.content

    filtered = admin_client.get(url, {"q": "Gamma"})
    assert filtered.status_code == 200
    assert b"Gamma Konsult" in filtered.content

    overdue = admin_client.get(url, {"follow_up": "overdue"})
    assert overdue.status_code == 200


def test_exclude_from_report_action(admin_client, user):
    app = JobApplication.objects.create(
        owner=user,
        company="Delta",
        title="Designer",
        status=JobApplication.STATUS_APPLIED,
        applied_at=timezone.localdate(),
    )
    url = reverse("admin:core_jobapplication_changelist")
    response = admin_client.post(
        url,
        {
            "action": "exclude_from_report",
            "_selected_action": [str(app.pk)],
        },
    )
    assert response.status_code == 302
    app.refresh_from_db()
    assert app.report_excluded is True


def test_user_changelist_shows_operator_id(admin_client, user):
    url = reverse("admin:auth_user_changelist")
    response = admin_client.get(url)
    assert response.status_code == 200
    operator_id = user.operator_profile.operator_id
    assert operator_id.encode() in response.content


def test_email_and_resume_changelists_load(admin_client):
    email_url = reverse("admin:account_emailaddress_changelist")
    resume_url = reverse("admin:core_resume_changelist")
    assert admin_client.get(email_url).status_code == 200
    assert admin_client.get(resume_url).status_code == 200


def test_dashboard_lists_inactivity_warnings(user):
    profile = user.operator_profile
    profile.deletion_warned_at = timezone.now()
    profile.save(update_fields=["deletion_warned_at"])
    context = dashboard_callback(request=None, context={})
    emails = [row["email"] for row in context["warned_accounts"]]
    assert user.email in emails
