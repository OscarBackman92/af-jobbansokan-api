"""Delete accounts inactive for 24 months, with a 30-day e-mail warning.

Implements the retention rule in the privacy policy. Run daily (cron).
Users are warned once; logging in clears the warning and the clock.
"""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from core.email_config import email_is_configured
from core.models import OperatorProfile
from core.spa_urls import spa_app_url

INACTIVITY_DAYS = 730  # 24 months
WARNING_DAYS = 30


class Command(BaseCommand):
    help = (
        "Warn and then delete accounts whose last activity is older than "
        f"{INACTIVITY_DAYS} days."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without sending mail or deleting.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        now = timezone.now()
        cutoff = now - timedelta(days=INACTIVITY_DAYS)
        User = get_user_model()

        # Activity resets the warning: anyone active since the cutoff
        # should not carry an old deletion warning.
        cleared = OperatorProfile.objects.filter(
            Q(user__last_login__gte=cutoff)
            | Q(user__last_login__isnull=True, user__date_joined__gte=cutoff),
            deletion_warned_at__isnull=False,
        )
        if dry_run:
            for profile in cleared:
                self.stdout.write(f"Would clear warning: {profile.user.email}")
        else:
            cleared.update(deletion_warned_at=None)

        inactive = (
            User.objects.filter(
                Q(last_login__lt=cutoff)
                | Q(last_login__isnull=True, date_joined__lt=cutoff),
                is_staff=False,
                is_superuser=False,
            )
            .select_related("operator_profile")
            .order_by("pk")
        )

        if not inactive.exists():
            self.stdout.write("No inactive accounts.")
            return

        if not email_is_configured() and not dry_run:
            # Never delete without being able to warn first.
            self.stderr.write(
                self.style.ERROR(
                    "E-post är inte konfigurerad; varningar kan inte skickas "
                    "och inga konton gallrades."
                )
            )
            return

        warned = deleted = 0
        for user in inactive:
            profile, _ = OperatorProfile.objects.get_or_create(user=user)
            if profile.deletion_warned_at is None:
                warned += self._warn(user, profile, dry_run)
            elif profile.deletion_warned_at <= now - timedelta(days=WARNING_DAYS):
                deleted += self._delete(user, dry_run)
            # else: warned recently — the grace period is still running.

        self.stdout.write(
            self.style.SUCCESS(f"Warned {warned}, deleted {deleted} account(s).")
        )

    def _warn(self, user, profile, dry_run):
        if not user.email:
            # No way to warn — treat the warning as sent so the account is
            # still removed after the grace period.
            if not dry_run:
                profile.deletion_warned_at = timezone.now()
                profile.save(update_fields=["deletion_warned_at"])
            self.stdout.write(f"No e-mail for user {user.pk}; grace period started.")
            return 0

        body = (
            "Hej!\n\n"
            "Ditt konto på Jobbsöket har varit inaktivt i 24 månader. "
            f"Enligt vår lagringspolicy raderas kontot och all data om "
            f"{WARNING_DAYS} dagar.\n\n"
            "Vill du behålla kontot? Logga bara in, så avbryts raderingen:\n"
            f"{spa_app_url() or 'https://ansokt.onrender.com/app/'}\n\n"
            "Vill du inte det behöver du inte göra någonting.\n\n"
            "Hälsningar,\nJobbsöket"
        )
        if dry_run:
            self.stdout.write(f"Would warn: {user.email}")
            return 1

        send_mail(
            subject="Jobbsöket — ditt konto raderas om 30 dagar",
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        profile.deletion_warned_at = timezone.now()
        profile.save(update_fields=["deletion_warned_at"])
        self.stdout.write(f"Warned {user.email}.")
        return 1

    def _delete(self, user, dry_run):
        if dry_run:
            self.stdout.write(f"Would delete: {user.email or user.pk}")
            return 1
        label = user.email or str(user.pk)
        user.delete()
        self.stdout.write(f"Deleted {label}.")
        return 1
