from __future__ import annotations

import re
from functools import lru_cache

from .skill_canonical import skill_match_terms


@lru_cache(maxsize=512)
def _skill_pattern(skill: str, *, prefix: bool = False) -> re.Pattern[str]:
    """Compile a case-insensitive, boundary-aware matcher for one skill.

    A skill matches only when it is not glued to an adjacent alphanumeric
    character, so short skills don't false-match inside larger words
    ("Go" must not hit "Django", "AI" not "Thailand", "R" not "React").

    The boundary is ``\\w`` (Unicode letters/digits/underscore), asserted
    with look-arounds rather than ``\\b`` — plain ``\\b`` breaks on
    symbol-edged skills like ``C++`` and ``C#`` whose final character is
    not a word character. Multi-word skills match as a phrase with
    flexible whitespace ("Power BI", "React Native", "Microsoft 365").

    When ``prefix`` is True the trailing boundary is relaxed so Swedish
    word forms like "upphandlingar" still match the stem "upphandl".
    """
    core = r"\s+".join(re.escape(part) for part in skill.split())
    if prefix:
        return re.compile(rf"(?<!\w){core}\w*", re.IGNORECASE)
    return re.compile(rf"(?<!\w){core}(?!\w)", re.IGNORECASE)


def _terms_hit_text(skill: str, text: str) -> bool:
    from .skill_canonical import PREFIX_STEMS, canonical_skill_label

    canonical_forms = skill_match_terms(skill)
    for term in canonical_forms:
        if _skill_pattern(term).search(text):
            return True
    canonical = canonical_skill_label(skill)
    stem = PREFIX_STEMS.get(canonical.casefold())
    if stem:
        for part in stem.split("|"):
            if part and _skill_pattern(part, prefix=True).search(text):
                return True
    return False


def match_skills(skills: list[str], posting) -> dict:
    """Requirement-coverage score for a posting-like object.

    Prefer ``score_posting`` for the full payload. This wrapper keeps the
    historical ``matched/missing/count/total`` keys while fixing the
    denominator to ad requirements (not CV size).
    """
    from .requirements import score_posting

    return score_posting(skills, posting)


def match_evidence(evidence: list[dict], posting) -> dict:
    """Match confirmed evidence against posting text with source attribution."""
    from .requirements import score_posting

    confirmed = [
        item for item in evidence if item.get("confirmed") and item.get("term")
    ]
    return score_posting(confirmed, posting)


def match_application_evidence(evidence: list[dict], application) -> dict:
    """Match evidence against a tracker row (uses ad_description)."""
    from .requirements import score_application

    confirmed = [
        item for item in evidence if item.get("confirmed") and item.get("term")
    ]
    return score_application(confirmed, application)


def match_application(skills: list[str], application) -> dict:
    """Match CV skills against a tracker row (uses ad_description)."""
    from .requirements import score_application

    return score_application(skills, application)


def legacy_cv_coverage(skills: list[str], posting) -> dict:
    """Old direction: which CV skills appear in the ad (non-percent metric)."""
    text = f"{getattr(posting, 'title', '')}\n{getattr(posting, 'description', '')}"
    matched = []
    for skill in skills:
        if not skill.strip():
            continue
        if _terms_hit_text(skill, text):
            matched.append(skill)
    normalized = [skill for skill in skills if skill.strip()]
    missing = [skill for skill in normalized if skill not in matched]
    return {
        "matched": matched,
        "missing": missing,
        "count": len(matched),
        "total": len(normalized),
    }
