import pytest

from config.frontend_url import resolve_frontend_url


@pytest.mark.parametrize(
    ("frontend_url", "render_host", "expected"),
    [
        ("https://ansokt.onrender.com", "", "https://jobbjungeln.onrender.com"),
        (
            "https://ansokt.onrender.com",
            "jobbjungeln.onrender.com",
            "https://jobbjungeln.onrender.com",
        ),
        ("", "jobbjungeln.onrender.com", "https://jobbjungeln.onrender.com"),
        (
            "https://jobbjungeln.onrender.com",
            "jobbjungeln.onrender.com",
            "https://jobbjungeln.onrender.com",
        ),
        ("https://jobbsoket.se", "jobbjungeln.onrender.com", "https://jobbsoket.se"),
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
