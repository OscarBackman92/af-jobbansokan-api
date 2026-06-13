"""Idempotent production bootstrap, driven entirely by env vars.

Runs on every container start (after migrate) but only acts when the
corresponding env vars are set and the object does not already exist.
Needed because Render's free tier has no shell access for one-off
commands like createsuperuser.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand

from core.models import JobPosting

User = get_user_model()


class Command(BaseCommand):
    help = "Idempotent env-driven bootstrap (superuser, postings)."

    def handle(self, *args, **options):
        self._superuser()
        self._postings()

    def _superuser(self):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        if not username or not password:
            return
        if User.objects.filter(username=username).exists():
            return
        User.objects.create_superuser(
            username, email=os.getenv("DJANGO_SUPERUSER_EMAIL", ""), password=password
        )
        self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' created."))

    def _postings(self):
        query = os.getenv("BOOTSTRAP_IMPORT_QUERY")
        if not query:
            return
        if JobPosting.objects.filter(source="jobtech").exists():
            return
        try:
            call_command("import_postings", "--query", query, "--limit", "50")
        except Exception as exc:  # network hiccup must not block boot
            self.stderr.write(f"Posting import skipped: {exc}")
