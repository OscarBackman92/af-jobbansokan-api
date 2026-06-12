"""Import job postings from Arbetsförmedlingen's open JobTech Search API.

https://jobsearch.api.jobtechdev.se — public, no API key required.
Postings are upserted on (source="jobtech", external_id), so re-running
the command refreshes existing rows instead of duplicating them.
"""

import requests
from django.core.management.base import BaseCommand, CommandError

from core.models import JobPosting

JOBTECH_SEARCH_URL = "https://jobsearch.api.jobtechdev.se/search"
MAX_LIMIT = 100


def to_posting_fields(hit: dict) -> dict:
    """Map a JobTech search hit to JobPosting fields."""
    employer = (hit.get("employer") or {}).get("name") or ""
    workplace = hit.get("workplace_address") or {}
    publication_date = (hit.get("publication_date") or "")[:10]
    deadline = (hit.get("application_deadline") or "")[:10]
    description = (hit.get("description") or {}).get("text") or ""
    return {
        "title": hit.get("headline") or "",
        "company_name": employer,
        "location": workplace.get("municipality") or "",
        "description": description,
        "webpage_url": (hit.get("webpage_url") or "")[:500],
        "published_at": publication_date or None,
        "application_deadline": deadline or None,
    }


class Command(BaseCommand):
    help = "Import job postings from Arbetsförmedlingen's JobTech Search API."

    def add_arguments(self, parser):
        parser.add_argument("--query", default="", help="Free text search query.")
        parser.add_argument(
            "--limit",
            type=int,
            default=20,
            help=f"Max postings to import (<= {MAX_LIMIT}).",
        )

    def handle(self, *args, **options):
        try:
            response = requests.get(
                JOBTECH_SEARCH_URL,
                params={
                    "q": options["query"],
                    "limit": min(options["limit"], MAX_LIMIT),
                },
                timeout=30,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise CommandError(f"JobTech request failed: {exc}") from exc

        hits = response.json().get("hits", [])

        created = updated = skipped = 0
        for hit in hits:
            external_id = str(hit.get("id") or "")
            fields = to_posting_fields(hit)
            if not external_id or not fields["title"]:
                skipped += 1
                continue
            _, was_created = JobPosting.objects.update_or_create(
                source="jobtech",
                external_id=external_id,
                defaults=fields,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {created} new, updated {updated}, skipped {skipped}."
            )
        )
