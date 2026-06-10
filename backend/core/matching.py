from __future__ import annotations


def match_skills(skills: list[str], posting) -> dict:
    """Rule-based skill match: which CV skills appear in the posting text.

    Deliberately simple and fully explainable (docs/09, principle 4) —
    the upgrade path is semantic matching, never a black box.
    """
    text = f"{posting.title}\n{posting.description}".lower()
    matched = [skill for skill in skills if skill.lower() in text]
    return {"matched": matched, "count": len(matched), "total": len(skills)}
