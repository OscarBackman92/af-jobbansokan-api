"""Tests for /api/v1/postings/ (job posting CRUD)."""
import pytest

from core.models import JobPosting


@pytest.mark.django_db
def test_list_postings_public(api_client, posting):
    response = api_client.get("/api/v1/postings/")
    assert response.status_code == 200
    assert response.json()["count"] == 1


@pytest.mark.django_db
def test_create_posting_as_employer_admin(employer_admin_client, org):
    payload = {
        "title": "Backend Engineer",
        "company_name": "Test Corp",
        "location": "Gothenburg",
    }
    response = employer_admin_client.post("/api/v1/postings/", payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Backend Engineer"
    assert data["organization"]["id"] == org.id


@pytest.mark.django_db
def test_create_posting_as_employer_member_forbidden(employer_member_client):
    payload = {"title": "Backend Engineer", "company_name": "Test Corp"}
    response = employer_member_client.post("/api/v1/postings/", payload)
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_posting_unauthenticated(api_client):
    payload = {"title": "Backend Engineer", "company_name": "Test Corp"}
    response = api_client.post("/api/v1/postings/", payload)
    # No credentials provided → 401 (DRF returns 403 only when credentials exist but are insufficient)
    assert response.status_code == 401


@pytest.mark.django_db
def test_update_posting_as_employer_admin(employer_admin_client, posting):
    response = employer_admin_client.patch(
        f"/api/v1/postings/{posting.id}/", {"title": "Senior Engineer"}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Senior Engineer"


@pytest.mark.django_db
def test_delete_posting_as_employer_admin(employer_admin_client, posting):
    response = employer_admin_client.delete(f"/api/v1/postings/{posting.id}/")
    assert response.status_code == 204
    assert not JobPosting.objects.filter(pk=posting.id).exists()


@pytest.mark.django_db
def test_search_postings_by_title(api_client, org):
    JobPosting.objects.create(
        organization=org, title="Python Developer", company_name="A", source="manual"
    )
    JobPosting.objects.create(
        organization=org, title="Java Developer", company_name="B", source="manual"
    )
    response = api_client.get("/api/v1/postings/?search=Python")
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["title"] == "Python Developer"


@pytest.mark.django_db
def test_search_postings_by_company(api_client, org):
    JobPosting.objects.create(
        organization=org, title="Dev", company_name="Acme Corp", source="manual"
    )
    JobPosting.objects.create(
        organization=org, title="Dev", company_name="Other Inc", source="manual"
    )
    response = api_client.get("/api/v1/postings/?search=Acme")
    assert response.status_code == 200
    assert response.json()["count"] == 1


@pytest.mark.django_db
def test_postings_paginated(api_client, org):
    for i in range(25):
        JobPosting.objects.create(
            organization=org,
            title=f"Job {i}",
            company_name="Corp",
            source="manual",
        )
    response = api_client.get("/api/v1/postings/")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 25
    assert len(data["results"]) == 20  # PAGE_SIZE
