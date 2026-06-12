import pytest

pytestmark = pytest.mark.django_db

REGISTER_URL = "/dj-rest-auth/registration/"
LOGIN_URL = "/dj-rest-auth/login/"


def test_register_with_email_returns_jwt(api_client):
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "anna@example.com",
            "password1": "Testpass123!",
            "password2": "Testpass123!",
        },
    )
    assert response.status_code == 201
    assert "access" in response.json()


def test_login_with_email(api_client):
    api_client.post(
        REGISTER_URL,
        {
            "email": "anna@example.com",
            "password1": "Testpass123!",
            "password2": "Testpass123!",
        },
    )
    response = api_client.post(
        LOGIN_URL, {"email": "anna@example.com", "password": "Testpass123!"}
    )
    assert response.status_code == 200
    assert "access" in response.json()


def test_register_requires_email(api_client):
    response = api_client.post(
        REGISTER_URL,
        {"password1": "Testpass123!", "password2": "Testpass123!"},
    )
    assert response.status_code == 400


def test_duplicate_email_rejected(api_client):
    payload = {
        "email": "anna@example.com",
        "password1": "Testpass123!",
        "password2": "Testpass123!",
    }
    api_client.post(REGISTER_URL, payload)
    response = api_client.post(REGISTER_URL, payload)
    assert response.status_code == 400
