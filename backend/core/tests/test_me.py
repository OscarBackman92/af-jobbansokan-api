"""Tests for GET /api/v1/me/."""
import pytest


@pytest.mark.django_db
def test_me_unauthenticated(api_client):
    response = api_client.get("/api/v1/me/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_me_returns_user_info(applicant_client, applicant):
    response = applicant_client.get("/api/v1/me/")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == applicant.id
    assert data["username"] == "applicant"
    assert data["email"] == "applicant@example.com"
    assert data["is_employer"] is False
    assert data["employer_role"] is None


@pytest.mark.django_db
def test_me_employer_shows_role(employer_admin_client, employer_admin):
    response = employer_admin_client.get("/api/v1/me/")
    assert response.status_code == 200
    data = response.json()
    assert data["is_employer"] is True
    assert data["employer_role"] == "admin"


@pytest.mark.django_db
def test_me_employer_member_shows_role(employer_member_client):
    response = employer_member_client.get("/api/v1/me/")
    assert response.status_code == 200
    data = response.json()
    assert data["is_employer"] is True
    assert data["employer_role"] == "member"
