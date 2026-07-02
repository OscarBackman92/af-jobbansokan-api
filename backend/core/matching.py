from __future__ import annotations

import re
from functools import lru_cache
from types import SimpleNamespace


@lru_cache(maxsize=512)
def _skill_pattern(skill: str) -> re.Pattern[str]:
    """Compile a case-insensitive, boundary-aware matcher for one skill.

    A skill matches only when it is not glued to an adjacent alphanumeric
    character, so short skills don't false-match inside larger words
    ("Go" must not hit "Django", "AI" not "Thailand", "R" not "React").

    The boundary is ``\\w`` (Unicode letters/digits/underscore), asserted
    with look-arounds rather than ``\\b`` — plain ``\\b`` breaks on
    symbol-edged skills like ``C++`` and ``C#`` whose final character is
    not a word character. Multi-word skills match as a phrase with
    flexible whitespace ("Power BI", "React Native", "Microsoft 365").
    """
    core = r"\s+".join(re.escape(part) for part in skill.split())
    return re.compile(rf"(?<!\w){core}(?!\w)", re.IGNORECASE)


def match_skills(skills: list[str], posting) -> dict:
    """Which CV skills appear in the posting text (title + description).

    Rule-based and fully explainable (docs/09, principle 4) — the upgrade
    path is semantic matching, never a black box.
    """
    text = f"{posting.title}\n{posting.description}"
    matched = [
        skill
        for skill in skills
        if skill.strip() and _skill_pattern(skill).search(text)
    ]
    normalized = [skill for skill in skills if skill.strip()]
    missing = [skill for skill in normalized if skill not in matched]
    return {
        "matched": matched,
        "missing": missing,
        "count": len(matched),
        "total": len(normalized),
    }


def match_application(skills: list[str], application) -> dict:
    """Match CV skills against a tracker row (title, notes, linked posting)."""
    description_parts = [application.company, application.notes]
    posting = getattr(application, "posting", None)
    if posting is not None and posting.description:
        description_parts.append(posting.description)
    posting_like = SimpleNamespace(
        title=application.title,
        description="\n".join(part for part in description_parts if part),
    )
    return match_skills(skills, posting_like)
