import pytest
from core.matching import match_skills
from core.models import JobPosting, Resume

pytestmark = pytest.mark.django_db

POSTINGS_URL = "/api/v1/postings/"


@pytest.fixture
def python_posting(db):
    return JobPosting.objects.create(
        title="Backendutvecklare",
        company_name="Acme AB",
        description="Vi arbetar med Python, Django och PostgreSQL.",
    )


def test_match_skills_is_case_insensitive(python_posting):
    result = match_skills(["python", "React", "PostgreSQL"], python_posting)
    assert result == {
        "matched": ["python", "PostgreSQL"],
        "count": 2,
        "total": 3,
    }


def test_list_includes_match_for_user_with_resume(api_client, user, python_posting):
    Resume.objects.create(user=user, skills=["Python", "React"])
    api_client.force_authenticate(user)

    results = api_client.get(POSTINGS_URL).json()["results"]
    match = results[0]["match"]
    assert match["matched"] == ["Python"]
    assert match["count"] == 1
    assert match["total"] == 2


def test_detail_includes_match(api_client, user, python_posting):
    Resume.objects.create(user=user, skills=["Django"])
    api_client.force_authenticate(user)

    body = api_client.get(f"{POSTINGS_URL}{python_posting.id}/").json()
    assert body["match"]["count"] == 1


def test_user_without_skills_gets_no_match_key(api_client, user, python_posting):
    Resume.objects.create(user=user, skills=[])
    api_client.force_authenticate(user)
    results = api_client.get(POSTINGS_URL).json()["results"]
    assert "match" not in results[0]
