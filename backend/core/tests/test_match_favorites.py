import pytest
from core.matching import match_skills
from core.models import Favorite, JobPosting, Resume

pytestmark = pytest.mark.django_db

POSTINGS_URL = "/api/v1/postings/"
FAVORITES_URL = "/api/v1/favorites/"


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


def test_favorites_crud_and_own_only(api_client, user, posting, django_user_model):
    api_client.force_authenticate(user)
    created = api_client.post(FAVORITES_URL, {"posting": posting.id})
    assert created.status_code == 201

    duplicate = api_client.post(FAVORITES_URL, {"posting": posting.id})
    assert duplicate.status_code == 400

    other = django_user_model.objects.create_user(username="other", password="x")
    Favorite.objects.create(user=other, posting=posting)

    body = api_client.get(FAVORITES_URL).json()
    assert body["count"] == 1
    assert body["results"][0]["posting_title"] == posting.title

    favorite_id = body["results"][0]["id"]
    assert api_client.delete(f"{FAVORITES_URL}{favorite_id}/").status_code == 204
    assert api_client.get(FAVORITES_URL).json()["count"] == 0
    # The other user's favorite is untouched.
    assert Favorite.objects.filter(user=other).count() == 1


def test_favorites_require_auth(api_client):
    assert api_client.get(FAVORITES_URL).status_code == 401
