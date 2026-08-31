import pytest

from config.frontend_url import public_origin_parts, resolve_frontend_url

CANONICAL = "https://jobbdjungeln.obackman.se"


@pytest.mark.parametrize(
    ("frontend_url", "render_host", "expected"),
    [
        ("https://ansokt.onrender.com", "", CANONICAL),
        (
            "https://ansokt.onrender.com",
            "jobbjungeln.onrender.com",
            CANONICAL,
        ),
        ("", "jobbjungeln.onrender.com", CANONICAL),
        (
            "https://jobbjungeln.onrender.com",
            "jobbjungeln.onrender.com",
            CANONICAL,
        ),
        ("https://jobbsoket.se", "jobbjungeln.onrender.com", "https://jobbsoket.se"),
        (CANONICAL, "jobbjungeln.onrender.com", CANONICAL),
        ("", "preview-pr-12.onrender.com", "https://preview-pr-12.onrender.com"),
        ("", "", ""),
    ],
)
def test_resolve_frontend_url(monkeypatch, frontend_url, render_host, expected):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.delenv("RENDER_EXTERNAL_HOSTNAME", raising=False)
    if frontend_url:
        monkeypatch.setenv("FRONTEND_URL", frontend_url)
    if render_host:
        monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", render_host)
    assert resolve_frontend_url() == expected


def test_custom_domain_is_trusted():
    from django.conf import settings

    assert "jobbdjungeln.obackman.se" in settings.ALLOWED_HOSTS
    assert "https://jobbdjungeln.obackman.se" in settings.CSRF_TRUSTED_ORIGINS


def test_public_origin_parts():
    assert public_origin_parts("") == ("", "")
    assert public_origin_parts("https://jobbdjungeln.se") == (
        "jobbdjungeln.se",
        "https://jobbdjungeln.se",
    )
    assert public_origin_parts("jobbdjungeln.se") == (
        "jobbdjungeln.se",
        "https://jobbdjungeln.se",
    )
