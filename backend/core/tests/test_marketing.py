import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return Client()


def test_landing_page_is_public_html(client):
    response = client.get("/")
    body = response.content.decode()
    assert response.status_code == 200
    assert "Jobbsöket" in body
    assert "Skapa konto" in body
    assert "Logga in" in body
    assert "Kom igång" in body
    assert "Tre flikar" in body
    assert "Öppna appen" not in body
    assert 'rel="canonical"' in body


def test_privacy_page_is_public(client):
    response = client.get("/integritet/")
    assert response.status_code == 200
    assert "Integritetspolicy" in response.content.decode()


def test_robots_disallows_app(client):
    response = client.get("/robots.txt")
    body = response.content.decode()
    assert response.status_code == 200
    assert "Disallow: /app/" in body
    assert "Sitemap:" in body


def test_sitemap_lists_public_urls(client):
    response = client.get("/sitemap.xml")
    body = response.content.decode()
    assert response.status_code == 200
    assert "<loc>" in body
    assert "/integritet/" in body


def test_auth_query_redirects_to_spa(client):
    response = client.get("/?verify_key=abc123")
    assert response.status_code == 302
    assert response["Location"] == "/app/?verify_key=abc123"


def test_spa_app_url_helper(settings):
    settings.FRONTEND_URL = "https://jobbsoket.example.com"
    from core.spa_urls import spa_app_url

    assert spa_app_url() == "https://jobbsoket.example.com/app/"
