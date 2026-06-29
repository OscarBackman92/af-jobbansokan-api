from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

pytestmark = pytest.mark.django_db

User = get_user_model()


def _run():
    out = StringIO()
    call_command("bootstrap", stdout=out)
    return out.getvalue()


def test_noop_without_env(api_client):
    _run()
    assert not User.objects.filter(is_superuser=True).exists()


def test_creates_superuser_idempotently(monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_USERNAME", "admin")
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "S3cret!!")

    first = _run()
    assert "Superuser 'admin' created." in first

    second = _run()  # must not duplicate or crash
    assert "created" not in second
    assert User.objects.filter(username="admin", is_superuser=True).count() == 1


def test_updates_site_from_frontend_url(monkeypatch):
    from django.contrib.sites.models import Site

    monkeypatch.setenv("FRONTEND_URL", "https://ansokt.onrender.com")
    _run()
    site = Site.objects.get(pk=1)
    assert site.domain == "ansokt.onrender.com"
    assert site.name == "Ansökt"
