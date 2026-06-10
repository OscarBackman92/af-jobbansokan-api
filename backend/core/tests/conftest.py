import pytest
from core.models import EmployerProfile, JobPosting, Organization
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
def applicant(db):
    return User.objects.create_user(username="applicant", password="x")


@pytest.fixture
def organization(db):
    return Organization.objects.create(name="Acme AB", org_number="556677-8899")


@pytest.fixture
def employer_admin(db, organization):
    user = User.objects.create_user(username="employer_admin", password="x")
    EmployerProfile.objects.create(user=user, organization=organization, role="admin")
    return user


@pytest.fixture
def employer_member(db, organization):
    user = User.objects.create_user(username="employer_member", password="x")
    EmployerProfile.objects.create(user=user, organization=organization, role="member")
    return user


@pytest.fixture
def posting(db, organization):
    return JobPosting.objects.create(
        organization=organization,
        title="Backend Developer",
        company_name="Acme AB",
    )
