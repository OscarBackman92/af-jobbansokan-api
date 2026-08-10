"""Write stable match snapshots onto JobApplication rows."""

from __future__ import annotations

from django.utils import timezone

from .job_profiles import (
    active_profile,
    confirmed_evidence,
    normalize_job_profiles,
    profile_skill_terms,
)
from .models import Resume
from .requirements import score_all_profiles, score_application, trim_snapshot
from .skill_groups import flatten_skill_groups, normalize_skill_groups


def _resume_for(user):
    return Resume.objects.filter(user=user).first()


def score_and_store(application, *, user=None) -> dict | None:
    """Compute live score and persist snapshot fields. Returns the score dict."""
    owner = user or application.owner
    resume = _resume_for(owner)
    evidence = []
    terms = []
    profile_id = ""
    if resume:
        try:
            profiles = normalize_job_profiles(
                resume.job_profiles or [], headline=resume.headline or ""
            )
        except ValueError:
            profiles = []
        if profiles:
            profile = active_profile(profiles)
            profile_id = str(profile.get("id") or "")
            evidence = confirmed_evidence(profile)
            terms = profile_skill_terms(profile)
        if not terms and resume.skill_groups:
            terms = flatten_skill_groups(normalize_skill_groups(resume.skill_groups))
        if not terms and resume.skills:
            terms = list(resume.skills)

    result = score_application(evidence or terms, application)
    if resume:
        posting_like = __import__(
            "core.requirements", fromlist=["posting_like_from_application"]
        ).posting_like_from_application(application)
        profiles_scored = score_all_profiles(resume, posting_like)
        if profiles_scored:
            best = profiles_scored[0]
            result["best_profile"] = best
            if best.get("profile_id"):
                profile_id = best["profile_id"]

    application.match_score = result.get("score")
    application.match_snapshot = trim_snapshot(result)
    application.match_version = 2
    application.match_scored_at = timezone.now()
    application.match_profile_id = profile_id or application.match_profile_id
    application.save(
        update_fields=[
            "match_score",
            "match_snapshot",
            "match_version",
            "match_scored_at",
            "match_profile_id",
            "updated_at",
        ]
    )
    return result
