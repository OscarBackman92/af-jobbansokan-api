from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.lifecycle import is_stale
from core.models import JobApplication

User = get_user_model()


class Command(BaseCommand):
    help = (
        "List applications that have gone silent long enough to close as "
        "inget svar. Never changes status — the user confirms in the UI."
    )

    def handle(self, *args, **options):
        total = 0
        for user in User.objects.filter(is_active=True).iterator():
            stale = [
                app
                for app in JobApplication.objects.filter(
                    owner=user,
                    archived_at__isnull=True,
                    status=JobApplication.STATUS_APPLIED,
                )
                if is_stale(app)
            ]
            if not stale:
                continue
            total += len(stale)
            self.stdout.write(
                f"{user.get_username()}: {len(stale)} stale application(s)"
            )
        if total == 0:
            self.stdout.write("No stale applications.")
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"{total} stale application(s) waiting for a manual close."
                )
            )
