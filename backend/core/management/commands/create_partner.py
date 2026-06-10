import secrets

from django.core.management.base import BaseCommand, CommandError

from core.models import PartnerClient
from core.partner_auth import hash_key


class Command(BaseCommand):
    help = "Create a partner client and print its API key (shown only once)."

    def add_arguments(self, parser):
        parser.add_argument("name", help="Partner name, e.g. the A-kassa.")

    def handle(self, *args, **options):
        name = options["name"]
        if PartnerClient.objects.filter(name=name).exists():
            raise CommandError(f"Partner '{name}' already exists.")

        key = secrets.token_urlsafe(32)
        PartnerClient.objects.create(name=name, key_hash=hash_key(key))
        self.stdout.write(self.style.SUCCESS(f"Partner '{name}' created."))
        self.stdout.write(f"API key (shown only once): {key}")
