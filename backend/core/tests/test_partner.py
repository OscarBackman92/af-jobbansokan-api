from io import StringIO

import pytest
from core.identity import pseudonymize_personal_number
from core.models import (
    ApplicantProfile,
    AuditLog,
    JobApplication,
    JobPosting,
    PartnerClient,
)
from core.partner_auth import hash_key
from django.core.management import call_command

pytestmark = pytest.mark.django_db

URL = "/api/v1/partner/application-events/"
KEY = "test-partner-key"
PNR = "19900101-2384"
PNR_DIGITS = "199001012384"


@pytest.fixture
def partner(db):
    return PartnerClient.objects.create(name="A-kassan Alfa", key_hash=hash_key(KEY))


@pytest.fixture
def applicant_identity(applicant):
    return ApplicantProfile.objects.create(
        user=applicant,
        personal_number_hash=pseudonymize_personal_number(PNR_DIGITS),
    )


def _auth(api_client, key=KEY):
    api_client.credentials(HTTP_AUTHORIZATION=f"Api-Key {key}")
    return api_client


def test_requires_api_key(api_client, partner):
    assert api_client.get(URL, {"person": PNR}).status_code == 401


def test_invalid_key_rejected(api_client, partner):
    response = _auth(api_client, "wrong-key").get(URL, {"person": PNR})
    assert response.status_code == 401


def test_inactive_partner_rejected(api_client, partner):
    partner.is_active = False
    partner.save()
    response = _auth(api_client).get(URL, {"person": PNR})
    assert response.status_code == 401


def test_jwt_user_cannot_access(api_client, applicant, partner):
    api_client.force_authenticate(applicant)
    assert api_client.get(URL, {"person": PNR}).status_code == 403


def test_person_param_required(api_client, partner):
    response = _auth(api_client).get(URL)
    assert response.status_code == 400


def test_person_must_be_a_personal_number(api_client, partner):
    response = _auth(api_client).get(URL, {"person": "12345"})
    assert response.status_code == 400


def test_unknown_person_yields_empty_list(api_client, partner):
    response = _auth(api_client).get(URL, {"person": "20000101-0000"})
    assert response.status_code == 200
    assert response.json() == []


def test_events_filtered_by_person_and_period(
    api_client,
    partner,
    applicant,
    applicant_identity,
    organization,
    django_user_model,
):
    other = django_user_model.objects.create_user(username="other2", password="x")
    postings = [
        JobPosting.objects.create(
            organization=organization, title=f"Job {i}", company_name="Acme AB"
        )
        for i in range(3)
    ]
    JobApplication.objects.create(
        owner=applicant, posting=postings[0], applied_at="2026-04-01"
    )
    inside = JobApplication.objects.create(
        owner=applicant, posting=postings[1], applied_at="2026-05-10"
    )
    JobApplication.objects.create(
        owner=other, posting=postings[2], applied_at="2026-05-12"
    )

    response = _auth(api_client).get(
        URL, {"person": PNR, "from": "2026-05-01", "to": "2026-05-31"}
    )
    assert response.status_code == 200
    data = response.json()
    assert [event["id"] for event in data] == [inside.id]
    # Least privilege: no applicant identifiers, no status.
    assert set(data[0]) == {
        "id",
        "applied_at",
        "posting_title",
        "company_name",
        "created_at",
    }


def test_disclosure_is_audit_logged(
    api_client, partner, applicant, applicant_identity, posting
):
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-05-10"
    )
    _auth(api_client).get(URL, {"person": PNR, "from": "2026-05-01"})

    entry = AuditLog.objects.get(action=AuditLog.ACTION_PARTNER_DISCLOSED)
    assert entry.actor is None
    assert entry.metadata["partner_client_id"] == partner.id
    assert entry.metadata["person_hash"] == applicant_identity.personal_number_hash
    assert entry.metadata["application_count"] == 1
    # The raw personal number must never reach the audit log.
    assert PNR_DIGITS not in str(entry.metadata)


def test_create_partner_command_issues_working_key(api_client):
    out = StringIO()
    call_command("create_partner", "A-kassan Beta", stdout=out)
    key = out.getvalue().rsplit(":", 1)[-1].strip()

    response = _auth(api_client, key).get(URL, {"person": PNR})
    assert response.status_code == 200
    assert response.json() == []
