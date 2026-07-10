"""Send reminder e-mails for overdue application follow-ups."""

from collections import defaultdict

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.email_config import email_is_configured
from core.models import JobApplication


class Command(BaseCommand):
    help = "E-mail users about applications whose next_action_at is due or overdue."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be sent without sending mail.",
        )

    def handle(self, *args, **options):
        today = timezone.localdate()
        due = (
            JobApplication.objects.filter(
                status__in=JobApplication.ACTIVE_STATUSES,
                next_action_at__isnull=False,
                next_action_at__lte=today,
            )
            .select_related("owner")
            .order_by("owner_id", "next_action_at")
        )

        if not due.exists():
            self.stdout.write("No follow-ups due.")
            return

        if not email_is_configured() and not options["dry_run"]:
            self.stderr.write(
                self.style.ERROR(
                    "E-post är inte konfigurerad (BREVO_API_KEY eller EMAIL_HOST); "
                    "påminnelser skickades inte."
                )
            )
            return

        by_user = defaultdict(list)
        for application in due:
            by_user[application.owner].append(application)

        sent = 0
        for user, applications in by_user.items():
            lines = [
                f"- {app.title} @ {app.company} (nästa steg {app.next_action_at})"
                for app in applications
            ]
            sent += self._send(user, lines, options["dry_run"])

        self.stdout.write(self.style.SUCCESS(f"Processed {sent} reminder mail(s)."))

    def _send(self, user, lines, dry_run):
        if not user.email:
            self.stdout.write(f"Skipping user {user.pk}: no e-mail address.")
            return 0

        body = (
            "Hej!\n\n"
            "Detta är en påminnelse från Jobbsöket om ansökningar som behöver "
            "din uppmärksamhet:\n\n"
            + "\n".join(lines)
            + "\n\nÖppna appen för att uppdatera status eller nästa steg.\n"
        )
        if dry_run:
            self.stdout.write(f"Would send to {user.email}:\n{body}")
            return 1

        send_mail(
            subject="Jobbsöket — dags att följa upp",
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        self.stdout.write(f"Sent reminder to {user.email}.")
        return 1
