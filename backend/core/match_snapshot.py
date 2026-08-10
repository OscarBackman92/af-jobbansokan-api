"""Write stable match snapshots onto JobApplication rows."""

from __future__ import annotations

import logging

from django.core.exceptions import FieldDoesNotExist
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

logger = logging.getLogger(__name__)

EMPTY_RESULT = {
    "must_total": 0,
    "must_covered": 0,
    "merit_total": 0,
    "merit_covered": 0,
    "score": None,
    "band": "unknown",
    "confidence": "low",
    "covered": [],
    "gaps": [],
    "unused_cv_terms": [],
    "formal": [],
    "cv_terms_used": 0,
    "cv_terms_total": 0,
}


def _resume_for(user):
    return Resume.objects.filter(user=user).first()


def _has_match_fields(application) -> bool:
    try:
        application._meta.get_field("match_snapshot")
        return True
    except FieldDoesNotExist:
        return False


def score_and_store(application, *, user=None) -> dict | None:
    """Compute live score and persist snapshot fields. Returns the score dict.

    Always attempts to stamp match_scored_at when columns exist, even if the
    requirement extract yields low confidence / empty coverage.
    """
    if not _has_match_fields(application):
        logger.error(
            "match_snapshot columns missing — run migrate before scoring"
        )
        return None

    owner = user or application.owner
    result = dict(EMPTY_RESULT)
    profile_id = ""
    try:
        resume = _resume_for(owner)
        evidence = []
        terms = []
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
                terms = flatten_skill_groups(
                    normalize_skill_groups(resume.skill_groups)
                )
            if not terms and resume.skills:
                terms = list(resume.skills)

        result = score_application(evidence or terms, application)
        if resume:
            from .requirements import posting_like_from_application

            posting_like = posting_like_from_application(application)
            profiles_scored = score_all_profiles(resume, posting_like)
            if profiles_scored:
                best = profiles_scored[0]
                result["best_profile"] = best
                if best.get("profile_id"):
                    profile_id = best["profile_id"]
    except Exception:
        logger.exception(
            "score_application failed for application %s — storing empty snapshot",
            getattr(application, "pk", None),
        )

    try:
        application.match_score = result.get("score")
        application.match_snapshot = trim_snapshot(result)
        application.match_version = 2
        application.match_scored_at = timezone.now()
        if profile_id:
            application.match_profile_id = profile_id
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
    except Exception:
        logger.exception(
            "Failed to persist match snapshot for application %s",
            getattr(application, "pk", None),
        )
        return None
