import pytest
from core.models import JobPosting
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture(autouse=True)
def _clear_cache():
    # Throttle counters live in the cache; keep tests independent.
    cache.clear()
    yield


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="anna", password="x")


@pytest.fixture
def posting(db):
    return JobPosting.objects.create(
        source="jobtech",
        external_id="j1",
        title="Backend Developer",
        company_name="Acme AB",
        location="Stockholm",
        webpage_url="https://example.com/annons/1",
    )
