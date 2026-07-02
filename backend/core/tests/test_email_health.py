"""Tests for e-mail health probes and send_test_email."""

import pytest
from core.email_health import clear_brevo_probe_cache, probe_brevo_api_key
from django.core import mail
from django.core.management import call_command

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_probe_cache():
    clear_brevo_probe_cache()
    yield
    clear_brevo_probe_cache()


def test_probe_brevo_without_key():
    ok, detail = probe_brevo_api_key(api_key="")
    assert ok is False
    assert detail == "no_brevo_api_key"


def test_probe_brevo_rejected(monkeypatch):
    class FakeResponse:
        status_code = 401

    def fake_get(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr("core.email_health.requests.get", fake_get)
    ok, detail = probe_brevo_api_key(api_key="bad-key")
    assert ok is False
    assert detail == "brevo_api_key_rejected"


def test_probe_brevo_ok(monkeypatch):
    class FakeResponse:
        status_code = 200

    def fake_get(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr("core.email_health.requests.get", fake_get)
    ok, detail = probe_brevo_api_key(api_key="good-key")
    assert ok is True
    assert detail == "ok"


def test_health_warns_when_brevo_key_rejected(client, settings, monkeypatch):
    settings.DEBUG = False
    monkeypatch.setenv("BREVO_API_KEY", "bad-key")
    monkeypatch.setattr(
        "core.email_health.probe_brevo_api_key",
        lambda **_: (False, "brevo_api_key_rejected"),
    )
    response = client.get("/health/")
    assert response.json()["warnings"] == [
        "email_delivery_unavailable:brevo_api_key_rejected"
    ]


def test_send_test_email(settings, monkeypatch):
    monkeypatch.setenv("EMAIL_HOST", "smtp.test")
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    call_command("send_test_email", "probe@example.com")
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["probe@example.com"]
    assert "testmejl" in mail.outbox[0].subject.lower()
