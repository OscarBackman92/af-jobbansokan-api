"""Evidence-backed job profiles — searchable lenses tied to CV rows."""

from __future__ import annotations

import uuid
from typing import Any

from .skill_canonical import canonical_skill_label
from .skill_groups import (
    EMPTY_SKILL_GROUPS,
    SKILL_GROUP_KEYS,
    flatten_skill_groups,
    normalize_skill_groups,
)

MAX_PROFILES = 3
SOURCE_TYPES = ("experience", "education", "manual")
EVIDENCE_CATEGORIES = SKILL_GROUP_KEYS


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _default_label(headline: str = "") -> str:
    text = headline.strip()
    return text if text else "Mitt jobbsök"


def empty_profile(*, label: str = "Mitt jobbsök", active: bool = True) -> dict:
    return {
        "id": _new_id(),
        "label": label[:120],
        "active": active,
        "evidence": [],
    }


def _normalize_source(raw: Any) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("Evidence source must be an object.")
    source_type = raw.get("type", "manual")
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"Unknown evidence source type: {source_type}")
    index = raw.get("index")
    if source_type in {"experience", "education"}:
        if not isinstance(index, int) or index < 0:
            raise ValueError(
                "Experience/education evidence requires a non-negative index."
            )
    else:
        index = None
    label = str(raw.get("label") or "").strip()
    return {"type": source_type, "index": index, "label": label}


def _normalize_evidence_item(raw: Any) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("Evidence must be an object.")
    term = canonical_skill_label(str(raw.get("term") or ""))
    if not term:
        raise ValueError("Evidence term is required.")
    category = raw.get("category", "domain")
    if category not in EVIDENCE_CATEGORIES:
        raise ValueError(f"Unknown evidence category: {category}")
    confirmed = bool(raw.get("confirmed", True))
    item_id = str(raw.get("id") or _new_id())
    return {
        "id": item_id,
        "term": term,
        "category": category,
        "source": _normalize_source(raw.get("source") or {"type": "manual"}),
        "confirmed": confirmed,
    }


def normalize_job_profiles(
    raw: Any,
    *,
    headline: str = "",
) -> list[dict]:
    """Return 0–3 normalized profiles; create a default when empty."""
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        raise ValueError("job_profiles must be a list.")

    profiles: list[dict] = []
    for item in raw[:MAX_PROFILES]:
        if not isinstance(item, dict):
            raise ValueError("Each job profile must be an object.")
        label = str(item.get("label") or _default_label(headline)).strip()[:120]
        if not label:
            raise ValueError("Profile label is required.")
        evidence_raw = item.get("evidence", [])
        if not isinstance(evidence_raw, list):
            raise ValueError("Profile evidence must be a list.")
        seen_terms: set[str] = set()
        evidence: list[dict] = []
        for row in evidence_raw:
            normalized = _normalize_evidence_item(row)
            lowered = normalized["term"].lower()
            if lowered in seen_terms:
                continue
            seen_terms.add(lowered)
            evidence.append(normalized)
        profiles.append(
            {
                "id": str(item.get("id") or _new_id()),
                "label": label,
                "active": bool(item.get("active")),
                "evidence": evidence,
            }
        )

    if not profiles:
        profiles = [empty_profile(label=_default_label(headline), active=True)]

    active_count = sum(1 for profile in profiles if profile["active"])
    if active_count != 1:
        for index, profile in enumerate(profiles):
            profile["active"] = index == 0
    return profiles


def active_profile(profiles: list[dict]) -> dict:
    for profile in profiles:
        if profile.get("active"):
            return profile
    return profiles[0]


def confirmed_evidence(profile: dict) -> list[dict]:
    return [item for item in profile.get("evidence", []) if item.get("confirmed")]


def evidence_to_skill_groups(evidence: list[dict]) -> dict[str, list[str]]:
    groups = {key: [] for key in SKILL_GROUP_KEYS}
    seen: set[str] = set()
    for item in evidence:
        if not item.get("confirmed"):
            continue
        term = item.get("term", "")
        lowered = term.lower()
        if not term or lowered in seen:
            continue
        seen.add(lowered)
        category = item.get("category", "domain")
        if category not in groups:
            category = "domain"
        groups[category].append(term)
    return normalize_skill_groups(groups)


def profiles_from_skill_groups(
    skill_groups: dict | None,
    *,
    headline: str = "",
) -> list[dict]:
    """Migrate legacy flat skill groups into one default profile."""
    groups = normalize_skill_groups(skill_groups or EMPTY_SKILL_GROUPS)
    evidence: list[dict] = []
    for category in SKILL_GROUP_KEYS:
        for term in groups.get(category, []):
            evidence.append(
                {
                    "id": _new_id(),
                    "term": term,
                    "category": category,
                    "source": {
                        "type": "manual",
                        "index": None,
                        "label": "Manuellt tillagd",
                    },
                    "confirmed": True,
                }
            )
    return [
        {
            "id": _new_id(),
            "label": _default_label(headline),
            "active": True,
            "evidence": evidence,
        }
    ]


def experience_source_label(index: int, row: dict) -> str:
    title = str(row.get("title") or "").strip()
    if title:
        return f"Erfarenhet {index + 1}: {title}"
    return f"Erfarenhet {index + 1}"


def education_source_label(index: int, row: dict) -> str:
    degree = str(row.get("degree") or row.get("school") or "").strip()
    if degree:
        return f"Utbildning {index + 1}: {degree}"
    return f"Utbildning {index + 1}"


def add_evidence_to_profile(
    profile: dict,
    *,
    term: str,
    category: str,
    source: dict,
    confirmed: bool = True,
) -> dict:
    """Return updated profile with one evidence item (deduped by term)."""
    label = canonical_skill_label(term)
    if not label:
        return profile
    lowered = label.lower()
    evidence = []
    replaced = False
    for item in profile.get("evidence", []):
        if item.get("term", "").lower() == lowered:
            evidence.append(
                {
                    **item,
                    "term": label,
                    "category": category,
                    "source": source,
                    "confirmed": confirmed,
                }
            )
            replaced = True
        else:
            evidence.append(item)
    if not replaced:
        evidence.append(
            {
                "id": _new_id(),
                "term": label,
                "category": category,
                "source": source,
                "confirmed": confirmed,
            }
        )
    return {**profile, "evidence": evidence}


def remove_evidence_term(profile: dict, term: str) -> dict:
    lowered = term.lower()
    evidence = [
        item
        for item in profile.get("evidence", [])
        if item.get("term", "").lower() != lowered
    ]
    return {**profile, "evidence": evidence}


def profile_skill_terms(profile: dict) -> list[str]:
    return flatten_skill_groups(evidence_to_skill_groups(confirmed_evidence(profile)))
