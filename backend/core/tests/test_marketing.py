import json

import pytest
from django.test import Client, override_settings

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return Client()


def test_landing_page_is_public_html(client):
    response = client.get("/")
    body = response.content.decode()
    assert response.status_code == 200
    assert "Jobbdjungeln" in body
    assert "Skapa konto" in body
    assert "Logga in" in body
    assert "Kom igång" in body
    assert "Till min översikt" in body
    assert 'data-authed-cta hidden' in body
    assert "{#" not in body
    assert "sessionStorage is per-tab" not in body
    assert body.count("Till min översikt") == 2
    assert body.count("Skapa konto") == 2
    assert "Tre flikar" in body
    assert "Öppna appen" not in body
    assert 'rel="canonical"' in body
    assert 'property="og:image"' in body
    assert "/og-image.jpg" in body
    assert 'rel="icon"' in body
    assert "<h1>" in body
    assert "Håll koll på ansökningarna" in body
    assert '{" "}' not in body
    assert "Integritetspolicy" in body
    assert "Vite" not in body
    assert "theme-boot.js" in body
    assert "/om/" in body
    assert "/faq/" in body
    assert 'type="application/ld+json"' in body
    assert 'src="' in body
    assert "publiceras här" not in body


def test_privacy_page_is_public(client):
    response = client.get("/integritet/")
    body = response.content.decode()
    assert response.status_code == 200
    assert "Integritetspolicy" in body
    assert "Brödsmulor" in body
    assert "<h1" in body
    assert "publiceras här" not in body


def test_unique_page_titles(client):
    titles = []
    for path in ("/", "/om/", "/faq/", "/integritet/"):
        body = client.get(path).content.decode()
        title = body.split("<title>", 1)[1].split("</title>", 1)[0]
        titles.append(title)
    assert len(set(titles)) == 4


def test_about_and_faq_pages(client):
    about = client.get("/om/")
    faq = client.get("/faq/")
    assert about.status_code == 200
    assert faq.status_code == 200
    assert "Om Jobbdjungeln" in about.content.decode()
    assert "Vanliga frågor" in faq.content.decode()
    assert "Kostar Jobbdjungeln något?" in faq.content.decode()


def test_robots_disallows_app(client):
    response = client.get("/robots.txt")
    body = response.content.decode()
    assert response.status_code == 200
    assert "Disallow: /app/" in body
    assert "Allow: /om/" in body
    assert "Allow: /faq/" in body
    assert "Sitemap:" in body


def test_sitemap_lists_public_urls(client):
    response = client.get("/sitemap.xml")
    body = response.content.decode()
    assert response.status_code == 200
    assert "<loc>" in body
    assert "/integritet/" in body
    assert "/om/" in body
    assert "/faq/" in body


def test_llms_txt(client):
    response = client.get("/llms.txt")
    body = response.content.decode()
    assert response.status_code == 200
    assert "Jobbdjungeln" in body
    assert "/om/" in body
    assert "/faq/" in body


def test_json_ld_home_has_local_business(client):
    response = client.get("/schema/home.json")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/ld+json")
    payload = json.loads(response.content.decode())
    types = {node.get("@type") for node in payload["@graph"]}
    assert "ProfessionalService" in types
    assert "WebApplication" in types
    assert "Organization" in types


def test_json_ld_faq_matches_page(client):
    response = client.get("/schema/faq.json")
    payload = json.loads(response.content.decode())
    faq_node = next(
        node for node in payload["@graph"] if node.get("@type") == "FAQPage"
    )
    questions = [item["name"] for item in faq_node["mainEntity"]]
    assert "Kostar Jobbdjungeln något?" in questions
    page = client.get("/faq/").content.decode()
    assert "Kostar Jobbdjungeln något?" in page


def test_branded_assets(client):
    favicon = client.get("/favicon.svg")
    og = client.get("/og-image.jpg")
    apple = client.get("/apple-touch-icon.png")
    assert favicon.status_code == 200
    assert favicon["Content-Type"].startswith("image/svg")
    assert og.status_code == 200
    assert og["Content-Type"].startswith("image/jpeg")
    assert apple.status_code == 200


@override_settings(DEBUG=False)
def test_custom_404_page(client):
    response = client.get("/sidan-finns-inte-xyz/")
    body = response.content.decode()
    assert response.status_code == 404
    assert "Sidan finns inte" in body
    assert "Jobbdjungeln" in body
    assert "noindex" in body
    assert "Till startsidan" in body


def test_auth_query_redirects_to_spa(client):
    response = client.get("/?verify_key=abc123")
    assert response.status_code == 302
    assert response["Location"] == "/app/?verify_key=abc123"


def test_spa_app_url_helper(settings):
    settings.FRONTEND_URL = "https://jobbdjungeln.example.com"
    from core.spa_urls import spa_app_url

    assert spa_app_url() == "https://jobbdjungeln.example.com/app/"
