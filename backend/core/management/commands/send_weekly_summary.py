"""Send the Monday morning weekly summary + saved-search digest."""

from datetime import timedelta

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.email_config import email_is_configured
from core.models import JobApplication, OperatorProfile, SavedJobSearch
from core.search_digest import build_search_digests, digest_job_count
from core.weekly_summary import (
    build_weekly_summary,
    format_weekly_summary_email,
    summary_has_content,
)

User = get_user_model()


class Command(BaseCommand):
    help = (
        "E-mail verified users a weekly pipeline summary and new hits from "
        "saved Platsbanken searches. Intended to run on Mondays."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be sent without sending mail.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Send even when it is not Monday or already sent this week.",
        )

    def handle(self, *args, **options):
        today = timezone.localdate()
        if today.weekday() != 0 and not options["force"]:
            self.stdout.write("Not Monday; skipping (use --force to override).")
            return

        if not email_is_configured() and not options["dry_run"]:
            self.stderr.write(
                self.style.ERROR(
                    "E-post är inte konfigurerad (BREVO_API_KEY eller EMAIL_HOST); "
                    "veckosammanfattningar skickades inte."
                )
            )
            return

        verified_ids = EmailAddress.objects.filter(
            verified=True, primary=True
        ).values_list("user_id", flat=True)
        users = (
            User.objects.filter(pk__in=verified_ids, job_applications__isnull=False)
            .distinct()
            .order_by("pk")
        )

        if not users.exists():
            self.stdout.write("No eligible users.")
            return

        frontend_url = settings.FRONTEND_URL
        sent = skipped = 0
        week_start = today - timedelta(days=today.weekday())

        for user in users:
            profile, _ = OperatorProfile.objects.get_or_create(user=user)
            if (
                not options["force"]
                and profile.weekly_summary_sent_at
                and profile.weekly_summary_sent_at.date() >= week_start
            ):
                skipped += 1
                continue

            applications = JobApplication.objects.filter(owner=user)
            summary = build_weekly_summary(applications, today=today)
            searches = SavedJobSearch.objects.filter(owner=user)
            digests = build_search_digests(searches, today=today)

            if not summary_has_content(
                summary, digest_count=digest_job_count(digests)
            ):
                skipped += 1
                continue

            subject, body = format_weekly_summary_email(
                summary,
                digests=digests,
                frontend_url=frontend_url,
            )

            if options["dry_run"]:
                self.stdout.write(f"Would send to {user.email}:\n{body}\n---")
                sent += 1
                continue

            if not user.email:
                self.stdout.write(f"Skipping user {user.pk}: no e-mail address.")
                skipped += 1
                continue

            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            profile.weekly_summary_sent_at = timezone.now()
            profile.save(update_fields=["weekly_summary_sent_at"])
            searches.update(digest_checked_at=timezone.now())
            self.stdout.write(f"Sent weekly summary to {user.email}.")
            sent += 1

        self.stdout.write(
            self.style.SUCCESS(f"Sent {sent}, skipped {skipped} user(s).")
        )
