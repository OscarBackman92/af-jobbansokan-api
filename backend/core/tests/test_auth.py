import pytest

from core.tests.conftest import register_user, verify_latest_email

pytestmark = pytest.mark.django_db

REGISTER_URL = "/dj-rest-auth/registration/"
LOGIN_URL = "/dj-rest-auth/login/"
REFRESH_URL = "/dj-rest-auth/token/refresh/"


def test_register_sends_verification_email(api_client, mailoutbox):
    response = register_user(api_client)
    assert response.status_code == 201
    body = response.json()
    assert "access" not in body
    assert "detail" in body
    assert len(mailoutbox) == 1
    assert "verify_key=" in mailoutbox[0].body


def test_register_rolls_back_when_verification_mail_fails(api_client, monkeypatch):
    from django.contrib.auth import get_user_model

    def fail_send(*_args, **_kwargs):
        raise TimeoutError("SMTP connection timed out")

    monkeypatch.setattr(
        "allauth.account.utils.send_email_confirmation",
        fail_send,
    )

    response = register_user(api_client)
    assert response.status_code == 400
    body = response.json()
    errors = body if isinstance(body, list) else body.get("non_field_errors", [str(body)])
    assert any("verifieringsmejlet" in str(msg).lower() for msg in errors)
    assert not get_user_model().objects.filter(email="anna@example.com").exists()


def test_login_blocked_until_email_verified(api_client, mailoutbox):
    register_user(api_client)
    login = api_client.post(
        LOGIN_URL,
        {"email": "anna@example.com", "password": "Testpass123!"},
    )
    assert login.status_code == 400

    verified = verify_latest_email(api_client, mailoutbox)
    assert verified.status_code == 200

    login = api_client.post(
        LOGIN_URL,
        {"email": "anna@example.com", "password": "Testpass123!"},
    )
    assert login.status_code == 200
    assert "access" in login.json()


def test_login_returns_usable_refresh_token(api_client, mailoutbox):
    """The SPA refreshes the 15-min access token in the background, so the
    refresh token must be in the body (not blanked by HTTPONLY) and the
    refresh endpoint must return a fresh, working access token."""
    register_user(api_client)
    verify_latest_email(api_client, mailoutbox)

    login = api_client.post(
        LOGIN_URL,
        {"email": "anna@example.com", "password": "Testpass123!"},
    ).json()
    assert login["refresh"], "refresh token must not be blank"

    refreshed = api_client.post(REFRESH_URL, {"refresh": login["refresh"]})
    assert refreshed.status_code == 200
    access = refreshed.json()["access"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert api_client.get("/api/v1/me/").status_code == 200


def test_unverified_user_cannot_use_api(api_client, mailoutbox):
    """JWT may be blocked at login; if a token existed, API would still 403."""
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import RefreshToken

    register_user(api_client)
    User = get_user_model()
    user = User.objects.get(email="anna@example.com")
    token = str(RefreshToken.for_user(user).access_token)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert api_client.get("/api/v1/me/").status_code == 403


def test_register_requires_email(api_client):
    response = api_client.post(
        REGISTER_URL,
        {"password1": "Testpass123!", "password2": "Testpass123!"},
    )
    assert response.status_code == 400


def test_duplicate_email_rejected(api_client, mailoutbox):
    register_user(api_client)
    response = register_user(api_client)
    assert response.status_code == 400


def test_password_reset_flow(api_client, mailoutbox):
    """Request a reset, follow the e-mailed uid/token, set a new password
    and log in with it — the whole loop the SPA drives."""
    import re

    register_user(api_client)
    verify_latest_email(api_client, mailoutbox)
    mailoutbox.clear()

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
