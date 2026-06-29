import pytest


@pytest.mark.django_db
def test_runtime_config_js(client):
    response = client.get("/runtime-config.js")
    assert response.status_code == 200
    assert "application/javascript" in response["Content-Type"]
    assert "window.__ANSOKT_CONFIG__" in response.content.decode()


@pytest.mark.django_db
def test_deploy_checks_warn_without_email_and_sentry(settings, monkeypatch):
    monkeypatch.delenv("EMAIL_HOST", raising=False)
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    settings.DEBUG = False

    from django.core import checks

    warnings = checks.run_checks(deploy=True)
    ids = {warning.id for warning in warnings}
    assert "core.E001" in ids
    assert "core.W001" in ids
