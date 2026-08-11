import pytest
from core.insights import build_skill_insights
from core.job_profiles import add_evidence_to_profile, empty_profile
from core.models import JobApplication, Resume
from django.utils import timezone

pytestmark = pytest.mark.django_db

URL = "/api/v1/insights/skills/"


def _app_with_gap(user, *, term: str, count: int = 1):
    for index in range(count):
        JobApplication.objects.create(
            owner=user,
            company=f"Co{index}",
            title=f"Role{index}",
            status="applied",
            applied_at=timezone.localdate(),
            match_score=40,
            match_scored_at=timezone.now(),
            match_snapshot={
                "must_total": 2,
                "must_covered": 1,
                "merit_total": 0,
                "merit_covered": 0,
                "gaps": [{"term": term, "level": "must"}],
                "covered": [],
            },
        )


def test_insights_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


def test_insights_works_without_resume(api_client, user):
    _app_with_gap(user, term="Power BI")
    api_client.force_authenticate(user)
    response = api_client.get(URL)
    assert response.status_code == 200
    body = response.json()
    assert any(row["term"] == "Power BI" for row in body["gap_terms"])


def test_gap_terms_exclude_owned_profile_skills(api_client, user):
    profile = add_evidence_to_profile(
        empty_profile(),
        term="IT-support",
        category="domain",
        source={"type": "manual", "label": "Från gap-analys"},
        confirmed=True,
    )
    Resume.objects.create(user=user, job_profiles=[profile])
    _app_with_gap(user, term="IT-support", count=3)
    _app_with_gap(user, term="SAP", count=2)

    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    terms = [row["term"] for row in body["gap_terms"]]
    assert "IT-support" not in terms
    assert "SAP" in terms


def test_gap_terms_exclude_case_insensitive(user):
    profile = add_evidence_to_profile(
        empty_profile(),
        term="Power BI",
        category="domain",
        source={"type": "manual", "label": "test"},
        confirmed=True,
    )
    Resume.objects.create(user=user, job_profiles=[profile])
    _app_with_gap(user, term="power bi", count=2)
    _app_with_gap(user, term="Excel", count=1)

    body = build_skill_insights(user)
    terms = [row["term"].casefold() for row in body["gap_terms"]]
    assert "power bi" not in terms
    assert "excel" in terms
