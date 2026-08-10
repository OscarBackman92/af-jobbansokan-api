"""Idempotent backfill of JobApplication match snapshots."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.match_snapshot import score_and_store
from core.models import JobApplication

User = get_user_model()


class Command(BaseCommand):
    help = "Backfill match_snapshot/match_score for applications with ad text."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            help="Limit to one user email (default: all users).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-score rows that already have a snapshot.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max rows to update (0 = no limit).",
        )

    def handle(self, *args, **options):
        qs = JobApplication.objects.filter(archived_at__isnull=True).select_related(
            "owner", "posting"
        )
        email = options.get("email")
        if email:
            qs = qs.filter(owner__email__iexact=email)
        if not options["force"]:
            qs = qs.filter(match_scored_at__isnull=True)

        # Prefer rows that have something to score against.
        from django.db.models import Q

        qs = (
            qs.filter(Q(ad_description__gt="") | Q(posting__isnull=False))
            .distinct()
            .order_by("id")
        )

        limit = options["limit"]
        updated = 0
        skipped = 0
        for app in qs.iterator(chunk_size=50):
            if limit and updated >= limit:
                break
            text = (app.ad_description or "").strip()
            if not text and not app.posting_id:
                skipped += 1
                continue
            result = score_and_store(app, user=app.owner)
            if result is not None:
                updated += 1
            else:
                skipped += 1
            if updated and updated % 25 == 0:
                self.stdout.write(f"… {updated} updated")

        self.stdout.write(
            self.style.SUCCESS(f"Backfill done: updated={updated} skipped={skipped}")
        )
