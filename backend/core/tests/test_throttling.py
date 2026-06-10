import pytest
from core.throttling import BankIDRateThrottle

pytestmark = pytest.mark.django_db

INITIATE = "/api/v1/auth/bankid/initiate/"


def test_bankid_initiate_is_throttled(api_client, settings, monkeypatch):
    settings.BANKID_MOCK = True
    monkeypatch.setattr(BankIDRateThrottle, "rate", "3/min", raising=False)

    for _ in range(3):
        response = api_client.post(INITIATE, {"personal_number": "19900101-2384"})
        assert response.status_code == 200

    blocked = api_client.post(INITIATE, {"personal_number": "19900101-2384"})
    assert blocked.status_code == 429
