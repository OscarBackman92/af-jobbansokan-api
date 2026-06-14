import pytest

pytestmark = pytest.mark.django_db

REGISTER_URL = "/dj-rest-auth/registration/"
LOGIN_URL = "/dj-rest-auth/login/"
REFRESH_URL = "/dj-rest-auth/token/refresh/"


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


def test_login_returns_usable_refresh_token(api_client):
    """The SPA refreshes the 15-min access token in the background, so the
    refresh token must be in the body (not blanked by HTTPONLY) and the
    refresh endpoint must return a fresh, working access token."""
    api_client.post(
        REGISTER_URL,
        {
            "email": "anna@example.com",
            "password1": "Testpass123!",
            "password2": "Testpass123!",
        },
    )
    login = api_client.post(
        LOGIN_URL, {"email": "anna@example.com", "password": "Testpass123!"}
    ).json()
    assert login["refresh"], "refresh token must not be blank"

    refreshed = api_client.post(REFRESH_URL, {"refresh": login["refresh"]})
    assert refreshed.status_code == 200
    access = refreshed.json()["access"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert api_client.get("/api/v1/me/").status_code == 200


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


def test_password_reset_flow(api_client, mailoutbox):
    """Request a reset, follow the e-mailed uid/token, set a new password
    and log in with it — the whole loop the SPA drives."""
    import re

    api_client.post(
        REGISTER_URL,
        {
            "email": "anna@example.com",
            "password1": "Testpass123!",
            "password2": "Testpass123!",
        },
    )

    requested = api_client.post(
        "/dj-rest-auth/password/reset/", {"email": "anna@example.com"}
    )
    assert requested.status_code == 200
    assert len(mailoutbox) == 1
    body = mailoutbox[0].body
    uid = re.search(r"reset_uid=([^&\s]+)", body).group(1)
    token = re.search(r"reset_token=([^&\s]+)", body).group(1)

    confirmed = api_client.post(
        "/dj-rest-auth/password/reset/confirm/",
        {
            "uid": uid,
            "token": token,
            "new_password1": "BrandNew123!",
            "new_password2": "BrandNew123!",
        },
    )
    assert confirmed.status_code == 200

    login = api_client.post(
        LOGIN_URL, {"email": "anna@example.com", "password": "BrandNew123!"}
    )
    assert login.status_code == 200
    assert "access" in login.json()


def test_password_reset_unknown_email_is_silent(api_client, mailoutbox):
    """Unknown e-mails return 200 (no account enumeration) and send nothing."""
    response = api_client.post(
        "/dj-rest-auth/password/reset/", {"email": "nobody@example.com"}
    )
    assert response.status_code == 200
    assert len(mailoutbox) == 0
