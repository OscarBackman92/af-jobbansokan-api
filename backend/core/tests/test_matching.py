import pytest
from core.matching import match_skills
from core.models import JobPosting

pytestmark = pytest.mark.django_db


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
        "missing": ["React"],
        "count": 2,
        "total": 3,
    }
