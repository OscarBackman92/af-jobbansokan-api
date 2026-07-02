"""New-job digest for saved Platsbanken searches."""

from __future__ import annotations

from datetime import date, timedelta

from django.utils import timezone

from . import jobtech
from .models import SavedJobSearch

MAX_JOBS_PER_SEARCH = 5
DEFAULT_LOOKBACK_DAYS = 7


def search_label(search: SavedJobSearch) -> str:
    return search.label or search.q or "Sparad sökning"


def since_date_for_search(search: SavedJobSearch, *, today: date) -> date:
    if search.digest_checked_at:
        return search.digest_checked_at.date()
    return today - timedelta(days=DEFAULT_LOOKBACK_DAYS)


def fetch_new_jobs(search: SavedJobSearch, *, since: date) -> list[dict]:
    """Return up to MAX_JOBS_PER_SEARCH hits published after *since*."""
    try:
        payload = jobtech.search(
            q=search.q,
            region=search.region,
            municipality=search.municipality,
            field=search.field,
            group=search.group,
            remote=search.remote,
            limit=25,
        )
    except jobtech.JobTechError:
        return []

    new_jobs: list[dict] = []
    for job in payload["results"]:
        published = job.get("published_at")
        if not published:
            continue
        try:
            published_date = date.fromisoformat(published[:10])
        except ValueError:
            continue
        if published_date <= since:
            continue
        new_jobs.append(job)
        if len(new_jobs) >= MAX_JOBS_PER_SEARCH:
            break
    return new_jobs


def build_search_digests(
    searches,
    *,
    today: date | None = None,
) -> list[tuple[str, list[dict]]]:
    """Return (label, new_jobs) pairs for each saved search with hits."""
    if today is None:
        today = timezone.localdate()

    digests: list[tuple[str, list[dict]]] = []
    for search in searches:
        since = since_date_for_search(search, today=today)
        jobs = fetch_new_jobs(search, since=since)
        if jobs:
            digests.append((search_label(search), jobs))
    return digests


def digest_job_count(digests: list[tuple[str, list[dict]]]) -> int:
    return sum(len(jobs) for _, jobs in digests)
