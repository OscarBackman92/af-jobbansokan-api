"""Skill insights from stored match snapshots."""

from __future__ import annotations

from collections import Counter
from datetime import timedelta

from django.utils import timezone

from .job_profiles import (
    active_profile,
    normalize_job_profiles,
    profile_skill_terms,
)
from .models import JobApplication, Resume
from .skill_canonical import canonical_skill_label

RESPONSE_STATUSES = {
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
    JobApplication.STATUS_OFFER,
    JobApplication.STATUS_ACCEPTED,
}

BANDS = (
    ("0-39", 0, 39),
    ("40-69", 40, 69),
    ("70-100", 70, 100),
)


def _owned_skill_keys(user) -> set[str]:
    """Canonical keys for terms already on the user's active profile."""
    resume = Resume.objects.filter(user=user).first()
    if not resume:
        return set()

    terms: list[str] = []
    try:
        profiles = normalize_job_profiles(
            resume.job_profiles or [], headline=resume.headline or ""
        )
    except ValueError:
        profiles = []
    if profiles:
        terms = profile_skill_terms(active_profile(profiles))
    if not terms and resume.skills:
        terms = list(resume.skills)
    return {canonical_skill_label(term).casefold() for term in terms if term}


def build_skill_insights(user, *, since_days: int = 365) -> dict:
    since = timezone.localdate() - timedelta(days=since_days)
    all_apps = JobApplication.objects.filter(owner=user, archived_at__isnull=True)
    total_apps = all_apps.count()
    rows = list(
        all_apps.filter(match_scored_at__isnull=False)
        .exclude(match_snapshot={})
        .filter(match_scored_at__date__gte=since)
        .only("status", "match_score", "match_snapshot", "match_profile_id")
    )
    with_posting = sum(
        1
        for row in rows
        if (row.match_snapshot or {}).get("must_total", 0)
        + (row.match_snapshot or {}).get("merit_total", 0)
        > 0
    )

    gap_counter: Counter[str] = Counter()
    gap_level: dict[str, str] = {}
    hit_counter: Counter[str] = Counter()
    unused_counter: Counter[str] = Counter()

    for row in rows:
        snap = row.match_snapshot or {}
        for gap in snap.get("gaps") or []:
            term = gap.get("term")
            if not term:
                continue
            gap_counter[term] += 1
            if gap.get("level") == "must" or term not in gap_level:
                gap_level[term] = gap.get("level") or "must"
        for covered in snap.get("covered") or []:
            term = covered.get("term")
            if term:
                hit_counter[term] += 1
        for term in snap.get("unused_cv_terms") or []:
            unused_counter[term] += 1

    total = max(len(rows), 1)
    owned = _owned_skill_keys(user)
    # Take a wider top-N before filtering so owned terms don't empty the list.
    gap_terms = [
        {
            "term": term,
            "level": gap_level.get(term, "must"),
            "count": count,
            "share": round(count / total, 3),
        }
        for term, count in gap_counter.most_common(24)
        if canonical_skill_label(term).casefold() not in owned
    ][:12]
    hit_terms = [
        {"term": term, "count": count, "share": round(count / total, 3)}
        for term, count in hit_counter.most_common(12)
    ]
    unused_terms = [
        {"term": term}
        for term, _ in unused_counter.most_common(12)
        if term not in hit_counter
    ]

    response_by_band = []
    for label, low, high in BANDS:
        band_rows = [
            row
            for row in rows
            if row.match_score is not None and low <= row.match_score <= high
        ]
        tracked = len(band_rows)
        responded = sum(1 for row in band_rows if row.status in RESPONSE_STATUSES)
        entry = {"band": label, "tracked": tracked, "responded": responded}
        if tracked >= 5:
            entry["rate"] = round(responded / tracked, 3)
        else:
            entry["rate"] = None
            entry["insufficient_data"] = True
        response_by_band.append(entry)

    by_profile: dict[str, dict] = {}
    for row in rows:
        pid = row.match_profile_id or "unknown"
        bucket = by_profile.setdefault(
            pid,
            {
                "profile_id": pid,
                "label": pid,
                "applied": 0,
                "responded": 0,
                "scores": [],
            },
        )
        if row.status != JobApplication.STATUS_WISHLIST:
            bucket["applied"] += 1
        if row.status in RESPONSE_STATUSES:
            bucket["responded"] += 1
        if row.match_score is not None:
            bucket["scores"].append(row.match_score)

    profile_rows = []
    for bucket in by_profile.values():
        applied = bucket["applied"]
        responded = bucket["responded"]
        scores = bucket["scores"]
        row = {
            "profile_id": bucket["profile_id"],
            "label": bucket["label"],
            "applied": applied,
            "responded": responded,
            "avg_score": int(round(sum(scores) / len(scores))) if scores else None,
        }
        if applied >= 5:
            row["rate"] = round(responded / applied, 3)
        else:
            row["rate"] = None
            row["insufficient_data"] = True
        profile_rows.append(row)

    return {
        "gap_terms": gap_terms,
        "hit_terms": hit_terms,
        "unused_terms": unused_terms,
        "response_by_band": response_by_band,
        "by_profile": profile_rows,
        "scope": {
            "applications": total_apps,
            "with_snapshot": len(rows),
            "with_posting": with_posting,
            "since": since.isoformat(),
            "hint": (
                None
                if rows
                else (
                    "Inga matchningssnapshots sparade ännu. "
                    "Spara eller markera jobb som sökta, eller vänta på "
                    "nästa deploy (backfill körs vid start)."
                )
            ),
        },
    }
