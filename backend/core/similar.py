"""Fuzzy duplicate detection for job applications. Notice, never a hard block."""

from __future__ import annotations

from difflib import SequenceMatcher

from .lifecycle import employer_key
from .models import JobApplication


def titles_similar(left: str, right: str) -> bool:
    a = (left or "").casefold().strip()
    b = (right or "").casefold().strip()
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.55


def find_similar_applications(
    user,
    *,
    company: str = "",
    title: str = "",
    source_job_id: str = "",
    exclude_id: int | None = None,
    limit: int = 5,
) -> list[JobApplication]:
    qs = JobApplication.objects.filter(owner=user, archived_at__isnull=True)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)

    matches: list[JobApplication] = []
    seen: set[int] = set()

    external = (source_job_id or "").strip()
    if external:
        for row in qs.exclude(source_job_id="").filter(source_job_id=external)[:limit]:
            seen.add(row.id)
            matches.append(row)

    key = employer_key(company)
    if key and title.strip():
        candidates = (
            qs.exclude(pk__in=seen)
            .filter(employer_key=key)
            .order_by("-applied_at", "-id")[:50]
        )
        for row in candidates:
            if titles_similar(title, row.title):
                seen.add(row.id)
                matches.append(row)
            if len(matches) >= limit:
                break
    return matches[:limit]


def similar_payload(rows: list[JobApplication]) -> list[dict]:
    return [
        {
            "id": row.id,
            "company": row.company,
            "title": row.title,
            "applied_at": row.applied_at.isoformat() if row.applied_at else None,
            "status": row.status,
            "source_job_id": row.source_job_id,
        }
        for row in rows
    ]
