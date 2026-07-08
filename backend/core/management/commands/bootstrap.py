"""Idempotent production bootstrap, driven entirely by env vars.

Runs on every container start (after migrate) but only acts when the
corresponding env vars are set and the object does not already exist.
Needed because Render's free tier has no shell access for one-off
commands like createsuperuser.
"""

import os
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Idempotent env-driven bootstrap (site domain, superuser)."

    def handle(self, *args, **options):
        self._site()
        self._superuser()

    def _site(self):
        """Keep django.contrib.sites in sync with the public app URL.

        allauth prefixes e-mail subjects with [site.domain]; the default
        example.com looks unprofessional and hurts deliverability.
        """
        frontend = settings.FRONTEND_URL.strip()
        if not frontend:
            render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
            if render_host:
                frontend = f"https://{render_host}"
        if not frontend:
            return

        parsed = urlparse(frontend if "://" in frontend else f"https://{frontend}")
        domain = parsed.netloc or parsed.path.split("/")[0]
        if not domain:
            return

        site, created = Site.objects.update_or_create(
            pk=settings.SITE_ID,
            defaults={"domain": domain, "name": "Jobbsöket"},
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Site record created for '{domain}'.")
            )
        else:
            self.stdout.write(f"Site domain set to '{domain}'.")

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
