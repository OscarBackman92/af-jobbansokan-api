import pytest


@pytest.mark.django_db
def test_health_ok(client):
    response = client.get("/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.django_db
def test_health_warns_when_email_missing_in_production(client, settings, monkeypatch):
    monkeypatch.delenv("EMAIL_HOST", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    settings.DEBUG = False
    response = client.get("/health/")
    assert response.json()["warnings"] == ["email_not_configured"]
