import pytest
from core.models import ApplicantProfile, AuditLog
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

INITIATE = "/api/v1/auth/bankid/initiate/"
COLLECT = "/api/v1/auth/bankid/collect/"
PNR = "19900101-2384"

User = get_user_model()


def _login(api_client):
    initiate = api_client.post(INITIATE, {"personal_number": PNR})
    assert initiate.status_code == 200
    collect = api_client.post(COLLECT, {"order_ref": initiate.json()["order_ref"]})
    assert collect.status_code == 200
    return collect.json()


def test_full_flow_issues_working_jwt(api_client, settings):
    settings.BANKID_MOCK = True
    result = _login(api_client)
    assert result["status"] == "complete"

    me = api_client.get("/api/v1/me/", HTTP_AUTHORIZATION=f"Bearer {result['access']}")
    assert me.status_code == 200
    assert me.json()["id"] == result["user_id"]


def test_creates_profile_and_audit_entry(api_client, settings):
    settings.BANKID_MOCK = True
    result = _login(api_client)

    profile = ApplicantProfile.objects.get(user_id=result["user_id"])
    assert profile.method == "bankid-mock"

    entry = AuditLog.objects.get(action=AuditLog.ACTION_IDENTITY_VERIFIED)
    assert entry.actor_id == result["user_id"]
    assert entry.metadata["person_hash"] == profile.personal_number_hash


def test_same_person_resolves_to_same_user(api_client, settings):
    settings.BANKID_MOCK = True
    first = _login(api_client)
    users_after_first = User.objects.count()
    second = _login(api_client)

    assert first["user_id"] == second["user_id"]
    assert User.objects.count() == users_after_first


def test_personal_number_never_stored_in_clear(api_client, settings):
    settings.BANKID_MOCK = True
    result = _login(api_client)

    digits = PNR.replace("-", "")
    profile = ApplicantProfile.objects.get(user_id=result["user_id"])
    assert digits not in profile.personal_number_hash
    assert digits not in profile.user.username
    entry = AuditLog.objects.get(action=AuditLog.ACTION_IDENTITY_VERIFIED)
    assert digits not in str(entry.metadata)


def test_invalid_personal_number_rejected(api_client, settings):
    settings.BANKID_MOCK = True
    response = api_client.post(INITIATE, {"personal_number": "1234"})
    assert response.status_code == 400


def test_invalid_order_ref_rejected(api_client, settings):
    settings.BANKID_MOCK = True
    response = api_client.post(COLLECT, {"order_ref": "tampered"})
    assert response.status_code == 400


def test_endpoints_disabled_without_mock_flag(api_client, settings):
    settings.BANKID_MOCK = False
    assert api_client.post(INITIATE, {"personal_number": PNR}).status_code == 503
    assert api_client.post(COLLECT, {"order_ref": "x"}).status_code == 503
