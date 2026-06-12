import pytest
from core.models import JobApplication
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/"

User = get_user_model()


def test_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


def test_get_returns_own_profile(api_client, user):
    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    assert body["username"] == "anna"


def test_patch_updates_contact_details(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.patch(
        URL,
        {"email": "anna@example.com", "first_name": "Anna", "last_name": "Svensson"},
    )
    assert response.status_code == 200

    user.refresh_from_db()
    assert user.email == "anna@example.com"
    assert user.first_name == "Anna"


def test_patch_cannot_change_username(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.patch(URL, {"username": "hacker"})
    assert response.status_code == 200  # read-only field silently ignored

    user.refresh_from_db()
    assert user.username == "anna"


def test_delete_erases_account_and_data(api_client, user):
    JobApplication.objects.create(owner=user, company="Acme", title="Dev")
    user_id = user.id
    api_client.force_authenticate(user)
    response = api_client.delete(URL)
    assert response.status_code == 204

    assert not User.objects.filter(id=user_id).exists()
    assert not JobApplication.objects.filter(owner_id=user_id).exists()
