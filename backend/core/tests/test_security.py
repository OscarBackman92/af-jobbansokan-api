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
