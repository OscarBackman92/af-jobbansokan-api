"""Backfill Platsbanken occupation fields from JobTech historical ads."""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand
from django.db.models import Q

from core.jobtech import JobTechError, empty_snapshot_updates, fetch_historical_ad
from core.models import JobApplication


class Command(BaseCommand):
    help = (
        "Fill occupation/hours on Platsbanken applications from the historical "
        "JobTech API. Dry-run by default; pass --apply to write."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            default=True,
            help="Log what would change without writing (default).",
        )
        parser.add_argument(
            "--apply",
            action="store_false",
            dest="dry_run",
            help="Persist filled-in fields.",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=0.25,
            help="Seconds to wait between historical API requests.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max rows to process (0 = no limit).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        delay = max(0.0, options["delay"])
        limit = options["limit"]
        qs = (
            JobApplication.objects.filter(
                source=JobApplication.SOURCE_PLATSBANKEN,
                source_job_id__gt="",
            )
            .filter(Q(occupation_concept_id="") | Q(occupation_concept_id__isnull=True))
            .order_by("id")
        )
        filled = 0
        unmatched = 0
        skipped = 0
        errors = 0
        processed = 0
        mode = "dry-run" if dry_run else "apply"
        self.stdout.write(f"Backfill occupations ({mode})")

        for app in qs.iterator(chunk_size=50):
            if limit and processed >= limit:
                break
            processed += 1
            job_id = app.source_job_id.strip()
            try:
                mapped = fetch_historical_ad(job_id)
            except JobTechError as exc:
                errors += 1
                self.stdout.write(f"error {job_id} application={app.id}: {exc}")
                if delay:
                    time.sleep(delay)
                continue

            if mapped is None:
                unmatched += 1
                self.stdout.write(f"404 {job_id} application={app.id}")
                if delay:
                    time.sleep(delay)
                continue

            updates = empty_snapshot_updates(app, mapped)
            if (
                not updates.get("occupation_concept_id")
                and not app.occupation_concept_id
            ):
                unmatched += 1
                self.stdout.write(
                    f"no occupation {job_id} application={app.id} "
                    f"headline={mapped.get('title') or app.title}"
                )
                if delay:
                    time.sleep(delay)
                continue

            if not updates:
                skipped += 1
                self.stdout.write(f"unchanged {job_id} application={app.id}")
                if delay:
                    time.sleep(delay)
                continue

            label = updates.get("occupation_label") or app.occupation_label
            concept = updates.get("occupation_concept_id") or app.occupation_concept_id
            self.stdout.write(
                f"fill {job_id} application={app.id} "
                f"{label} ({concept}) fields={sorted(updates)}"
            )
            if not dry_run:
                for key, value in updates.items():
                    setattr(app, key, value)
                app.save(update_fields=[*updates, "updated_at"])
            filled += 1
            if delay:
                time.sleep(delay)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done ({mode}): filled={filled} unmatched={unmatched} "
                f"skipped={skipped} errors={errors} processed={processed}"
            )
        )
