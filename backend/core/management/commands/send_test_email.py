"""Send a test transactional e-mail (for production smoke checks)."""

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError

from core.email_config import email_is_configured
from core.email_health import probe_brevo_api_key


class Command(BaseCommand):
    help = (
        "Send a test e-mail via the configured backend (Brevo/SMTP). "
        "Use on Render Shell to verify delivery end-to-end."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            help="E-mail address that should receive the test message.",
        )

    def handle(self, *args, **options):
        recipient = options["recipient"].strip()
        if not recipient or "@" not in recipient:
            raise CommandError("Provide a valid recipient e-mail address.")

        if not email_is_configured():
            raise CommandError(
                "No mail backend configured. Set BREVO_API_KEY or EMAIL_HOST."
            )

        if settings.BREVO_API_KEY:
            ok, detail = probe_brevo_api_key()
            if not ok:
                raise CommandError(
                    f"Brevo API key check failed ({detail}). "
                    "Rotate the key in Brevo and update Render env vars."
                )

        body = (
            "Det här är ett testmejl från Jobbsöket.\n\n"
            "Om du ser detta fungerar utskicket. Verifieringsmejl och "
            "lösenordsåterställning ska också fungera.\n"
        )
        try:
            send_mail(
                subject="Jobbsöket — testmejl",
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
        except Exception as exc:
            raise CommandError(
                f"Send failed: {exc}. Check DEFAULT_FROM_EMAIL is a verified "
                "sender in Brevo (Senders & Domains)."
            ) from exc

        self.stdout.write(self.style.SUCCESS(f"Test e-mail sent to {recipient}."))
