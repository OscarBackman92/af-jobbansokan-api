import re

import pytest
from allauth.account.models import EmailAddress
from core.models import JobPosting
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

User = get_user_model()

REGISTER_PAYLOAD = {
    "email": "anna@example.com",
    "password1": "Testpass123!",
    "password2": "Testpass123!",
}

VERIFY_URL = "/dj-rest-auth/registration/verify-email/"


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    # Throttle counters live in the cache; keep tests independent.
    cache.clear()
    yield


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    user = User.objects.create_user(
        username="anna",
        email="anna@example.com",
        password="x",
    )
    EmailAddress.objects.create(
        user=user,
        email=user.email,
        verified=True,
        primary=True,
    )
    return user


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


def register_user(api_client, payload=None):
    return api_client.post(
        "/dj-rest-auth/registration/",
        payload or REGISTER_PAYLOAD,
    )


def verify_latest_email(api_client, mailoutbox=None, email="anna@example.com"):
    if mailoutbox:
        for message in reversed(mailoutbox):
            match = re.search(r"verify_key=([^&\s]+)", message.body)
            if match:
                return api_client.post(VERIFY_URL, {"key": match.group(1)})

    from allauth.account.models import EmailAddress, EmailConfirmation

    addr = EmailAddress.objects.get(user__email__iexact=email)
    confirmation = EmailConfirmation.create(addr)
    return api_client.post(VERIFY_URL, {"key": confirmation.key})
