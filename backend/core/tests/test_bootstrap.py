from io import StringIO

import pytest
from core.models import PartnerClient
from core.partner_auth import hash_key
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
    assert not PartnerClient.objects.exists()


def test_creates_superuser_and_partner_idempotently(monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_USERNAME", "admin")
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "S3cret!!")
    monkeypatch.setenv("BOOTSTRAP_PARTNER_NAME", "A-kassan Demo")
    monkeypatch.setenv("BOOTSTRAP_PARTNER_KEY", "demo-key")

    first = _run()
    assert "Superuser 'admin' created." in first
    assert "Partner 'A-kassan Demo' created." in first

    second = _run()  # must not duplicate or crash
    assert "created" not in second
    assert User.objects.filter(username="admin", is_superuser=True).count() == 1
    partner = PartnerClient.objects.get(name="A-kassan Demo")
    assert partner.key_hash == hash_key("demo-key")
