"""Structured CV skill groups — kept explainable and user-editable."""

from __future__ import annotations

SKILL_GROUP_KEYS = ("technical", "domain", "languages")

EMPTY_SKILL_GROUPS: dict[str, list[str]] = {
    "technical": [],
    "domain": [],
    "languages": [],
}


def normalize_skill_groups(raw) -> dict[str, list[str]]:
    """Return a clean skill_groups dict with only known keys."""
    if not isinstance(raw, dict):
        raise ValueError("Expected an object.")

    groups: dict[str, list[str]] = {}
    for key in SKILL_GROUP_KEYS:
        items = raw.get(key, [])
        if items is None:
            items = []
        if not isinstance(items, list):
            raise ValueError(f"{key} must be a list.")
        seen: set[str] = set()
        cleaned: list[str] = []
        for item in items:
            if not isinstance(item, str):
                raise ValueError(f"{key} must be a list of strings.")
            text = item.strip()
            lowered = text.lower()
            if text and lowered not in seen:
                seen.add(lowered)
                cleaned.append(text)
        groups[key] = cleaned
    return groups


def flatten_skill_groups(groups: dict[str, list[str]]) -> list[str]:
    """Merge groups into one list for annons matching (deduped, stable order)."""
    flat: list[str] = []
    seen: set[str] = set()
    for key in SKILL_GROUP_KEYS:
        for item in groups.get(key, []):
            lowered = item.lower()
            if lowered not in seen:
                seen.add(lowered)
                flat.append(item)
    return flat


def skill_groups_from_flat(skills: list[str]) -> dict[str, list[str]]:
    """Legacy flat skills → all in technical."""
    return {
        "technical": [item.strip() for item in skills if isinstance(item, str) and item.strip()],
        "domain": [],
        "languages": [],
    }
