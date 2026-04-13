"""Shared pytest fixtures for the core test suite."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Organization, EmployerProfile, JobPosting

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def applicant(db):
    return User.objects.create_user(username="applicant", password="pass1234", email="applicant@example.com")


@pytest.fixture
def applicant_client(api_client, applicant):
    api_client.force_authenticate(user=applicant)
    return api_client


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Test Corp", org_number="556000-0001")


@pytest.fixture
def employer_admin(db, org):
    user = User.objects.create_user(username="employer_admin", password="pass1234", email="admin@corp.com")
    EmployerProfile.objects.create(user=user, organization=org, role="admin")
    return user


@pytest.fixture
def employer_member(db, org):
    user = User.objects.create_user(username="employer_member", password="pass1234", email="member@corp.com")
    EmployerProfile.objects.create(user=user, organization=org, role="member")
    return user


@pytest.fixture
def employer_admin_client(api_client, employer_admin):
    api_client.force_authenticate(user=employer_admin)
    return api_client


@pytest.fixture
def employer_member_client(api_client, employer_member):
    api_client.force_authenticate(user=employer_member)
    return api_client


@pytest.fixture
def posting(db, org):
    return JobPosting.objects.create(
        organization=org,
        title="Software Engineer",
        company_name="Test Corp",
        location="Stockholm",
        source="manual",
    )
