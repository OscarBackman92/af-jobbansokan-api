"""Boot a throwaway Django backend for the Playwright E2E suite.

Fresh SQLite DB per run, mail written to e2e/.mail/ (the specs read the
verification links from there), and JobTech pointed at the local mock
server. Started by playwright.config.js as a webServer.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

E2E_DIR = Path(__file__).resolve().parent
REPO_ROOT = E2E_DIR.parents[1]
BACKEND_DIR = REPO_ROOT / "backend"

DB_PATH = E2E_DIR / ".e2e-db.sqlite3"
MAIL_DIR = E2E_DIR / ".mail"

PORT = "8765"
FRONTEND_ORIGIN = "http://127.0.0.1:5273"
MOCK_JOBTECH = "http://127.0.0.1:9797"

os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["DJANGO_DEBUG"] = "1"
os.environ["DB_ENGINE"] = "django.db.backends.sqlite3"
os.environ["DB_NAME"] = str(DB_PATH)
os.environ["EMAIL_FILE_PATH"] = str(MAIL_DIR)
os.environ["JOBTECH_SEARCH_URL"] = f"{MOCK_JOBTECH}/search"
os.environ["JOBTECH_TAXONOMY_URL"] = f"{MOCK_JOBTECH}/taxonomy"
os.environ["FRONTEND_URL"] = FRONTEND_ORIGIN
# The suite logs in once per spec from the same IP; the production rate
# (5/min) would throttle legitimate test traffic.
os.environ["DJANGO_AUTH_THROTTLE_RATE"] = "100/min"
# Never inherit production-ish settings from a local .env.
for var in ("DATABASE_URL", "BREVO_API_KEY", "EMAIL_HOST", "SENTRY_DSN"):
    os.environ.pop(var, None)

sys.path.insert(0, str(BACKEND_DIR))

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402


def reset_state() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    if MAIL_DIR.exists():
        shutil.rmtree(MAIL_DIR)
    MAIL_DIR.mkdir()


def seed() -> None:
    """One pre-verified user so login/board specs skip the mail dance."""
    from allauth.account.models import EmailAddress
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(
        username="e2e",
        email="e2e@example.com",
        password="E2epassword123!",
    )
    EmailAddress.objects.create(
        user=user, email=user.email, verified=True, primary=True
    )


if __name__ == "__main__":
    reset_state()
    call_command("migrate", "--no-input", verbosity=0)
    seed()
    call_command("runserver", f"127.0.0.1:{PORT}", use_reloader=False)
