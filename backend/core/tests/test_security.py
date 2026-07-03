import pytest
from core.tests.conftest import register_user, verify_latest_email
from django.conf import settings
from django.test import override_settings

pytestmark = pytest.mark.django_db

LOGIN_URL = "/dj-rest-auth/login/"


@override_settings(DEBUG=False)
def test_csp_header_in_production(client):
    response = client.get("/health/")
    assert response.status_code == 200
    csp = response.headers.get("Content-Security-Policy", "")
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


def test_security_headers_middleware_before_whitenoise():
    """WhiteNoise short-circuits; headers middleware must run first."""
    middleware = settings.MIDDLEWARE
    sh_idx = middleware.index("core.middleware.SecurityHeadersMiddleware")
    wn_idx = middleware.index("whitenoise.middleware.WhiteNoiseMiddleware")
    assert sh_idx < wn_idx


@override_settings(DEBUG=False)
def test_csp_header_on_spa_root(client):
    response = client.get("/")
    assert response.status_code == 200
    csp = response.headers.get("Content-Security-Policy", "")
    assert "default-src 'self'" in csp
    assert response.headers.get("X-Frame-Options") == "DENY"


@override_settings(DEBUG=True)
def test_csp_header_absent_in_debug(client):
    response = client.get("/health/")
    assert "Content-Security-Policy" not in response.headers


@override_settings(DEBUG=False)
def test_api_docs_require_admin(client):
    response = client.get("/api/docs/")
    assert response.status_code in (401, 403)


@override_settings(DEBUG=True)
def test_api_docs_public_in_debug(client):
    response = client.get("/api/docs/")
    assert response.status_code == 200


def test_auth_throttle_scope_configured():
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["dj_rest_auth"] == "5/min"


def test_login_throttled_after_repeated_failures(api_client, mailoutbox):
    register_user(api_client)
    verify_latest_email(api_client, mailoutbox)

    for _ in range(5):
        api_client.post(
            LOGIN_URL,
            {"email": "anna@example.com", "password": "wrong-password"},
        )

    blocked = api_client.post(
        LOGIN_URL,
        {"email": "anna@example.com", "password": "wrong-password"},
    )
    assert blocked.status_code == 429


def test_security_txt_serves_contact(client, settings):
    settings.CONTACT_EMAIL = "security@example.com"
    response = client.get("/.well-known/security.txt")
    assert response.status_code == 200
    body = response.content.decode()
    assert "Contact: mailto:security@example.com" in body
    assert "Expires:" in body


def test_security_txt_missing_without_contact(client, settings):
    settings.CONTACT_EMAIL = ""
    response = client.get("/.well-known/security.txt")
    assert response.status_code == 404


def test_password_change_revokes_refresh_tokens(api_client, user):
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    api_client.force_authenticate(user)

    response = api_client.post(
        "/dj-rest-auth/password/change/",
        {"new_password1": "NyttLosen123!", "new_password2": "NyttLosen123!"},
    )
    assert response.status_code == 200

    api_client.force_authenticate(None)
    refreshed = api_client.post(
        "/dj-rest-auth/token/refresh/", {"refresh": str(refresh)}
    )
    assert refreshed.status_code == 401, "old refresh token must be blacklisted"
