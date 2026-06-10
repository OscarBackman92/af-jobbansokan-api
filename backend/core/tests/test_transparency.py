import pytest
from core.audit import log_event
from core.identity import pseudonymize_personal_number
from core.models import ApplicantProfile, AuditLog, JobApplication

pytestmark = pytest.mark.django_db

DISCLOSURES_URL = "/api/v1/me/disclosures/"
EXPORT_URL = "/api/v1/applications/export/"


@pytest.fixture
def applicant_identity(applicant):
    return ApplicantProfile.objects.create(
        user=applicant,
        personal_number_hash=pseudonymize_personal_number("199001012384"),
    )


def _log_disclosure(person_hash, partner="A-kassan Alfa", count=2):
    log_event(
        None,
        AuditLog.ACTION_PARTNER_DISCLOSED,
        partner_client_id=1,
        partner_name=partner,
        person_hash=person_hash,
        date_from="2026-05-01",
        date_to="2026-06-30",
        application_count=count,
    )


def test_disclosures_require_auth(api_client):
    assert api_client.get(DISCLOSURES_URL).status_code == 401


def test_user_sees_only_own_disclosures(api_client, applicant, applicant_identity):
    _log_disclosure(applicant_identity.personal_number_hash)
    _log_disclosure(pseudonymize_personal_number("200001010000"), partner="Annan")

    api_client.force_authenticate(applicant)
    body = api_client.get(DISCLOSURES_URL).json()
    assert body["count"] == 1
    entry = body["results"][0]
    assert entry["partner_name"] == "A-kassan Alfa"
    assert entry["date_from"] == "2026-05-01"
    assert entry["application_count"] == 2


def test_unverified_user_gets_empty_list(api_client, applicant):
    _log_disclosure(pseudonymize_personal_number("199001012384"))
    api_client.force_authenticate(applicant)
    assert api_client.get(DISCLOSURES_URL).json()["count"] == 0


def test_export_requires_auth(api_client):
    assert api_client.get(EXPORT_URL).status_code == 401


def test_export_returns_own_applications_as_csv(
    api_client, applicant, posting, django_user_model
):
    other = django_user_model.objects.create_user(username="other", password="x")
    JobApplication.objects.create(owner=other, posting=posting, applied_at="2026-06-01")
    JobApplication.objects.create(
        owner=applicant, posting=posting, applied_at="2026-06-02"
    )

    api_client.force_authenticate(applicant)
    response = api_client.get(EXPORT_URL)
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert "attachment" in response["Content-Disposition"]

    content = response.content.decode("utf-8-sig")
    lines = [line for line in content.splitlines() if line]
    assert len(lines) == 2  # header + one own application
    assert "2026-06-02" in lines[1]
    assert posting.title in lines[1]


def test_export_applies_date_filters(api_client, applicant, organization):
    from core.models import JobPosting

    for applied in ["2026-05-01", "2026-06-01"]:
        JobApplication.objects.create(
            owner=applicant,
            posting=JobPosting.objects.create(
                organization=organization, title=f"Job {applied}", company_name="Acme"
            ),
            applied_at=applied,
        )

    api_client.force_authenticate(applicant)
    response = api_client.get(EXPORT_URL, {"from": "2026-05-15"})
    lines = [line for line in response.content.decode("utf-8-sig").splitlines() if line]
    assert len(lines) == 2
    assert "2026-06-01" in lines[1]
