"""Suggest CV skills from experience text — rule-based and explainable."""

from __future__ import annotations

from .matching import _skill_pattern
from .skill_canonical import canonical_skill_label
from .skill_groups import SKILL_GROUP_KEYS, flatten_skill_groups, normalize_skill_groups

# (canonical label, category). Longer phrases are matched first.
TOOL_TERMS: list[tuple[str, str]] = [
    ("Microsoft 365", "technical"),
    ("Power BI", "technical"),
    ("SharePoint", "technical"),
    ("Salesforce", "technical"),
    ("Fortnox", "technical"),
    ("Visma", "technical"),
    ("Wint", "technical"),
    ("SAP", "technical"),
    ("Oracle", "technical"),
    ("HubSpot", "technical"),
    ("Jira", "technical"),
    ("Confluence", "technical"),
    ("GitHub", "technical"),
    ("GitLab", "technical"),
    ("Docker", "technical"),
    ("Kubernetes", "technical"),
    ("PostgreSQL", "technical"),
    ("SQL Server", "technical"),
    ("AutoCAD", "technical"),
    ("Python", "technical"),
    ("JavaScript", "technical"),
    ("TypeScript", "technical"),
    ("Java", "technical"),
    ("C#", "technical"),
    (".NET", "technical"),
    ("React", "technical"),
    ("Node.js", "technical"),
    ("Django", "technical"),
    ("Excel", "technical"),
    ("SQL", "technical"),
]

DOMAIN_TERMS: list[tuple[str, str]] = [
    ("projektledning", "domain"),
    ("projektledare", "domain"),
    ("processutveckling", "domain"),
    ("regelefterlevnad", "domain"),
    ("egenkontroller", "domain"),
    ("attestering", "domain"),
    ("attestflöden", "domain"),
    ("attest", "domain"),
    ("kontering", "domain"),
    ("bokföring", "domain"),
    ("bokslut", "domain"),
    ("redovisning", "domain"),
    ("fakturering", "domain"),
    ("leverantörsfakturor", "domain"),
    ("kundfakturor", "domain"),
    ("avstämning", "domain"),
    ("ekonomi", "domain"),
    ("administration", "domain"),
    ("löneadministration", "domain"),
    ("löner", "domain"),
    ("moms", "domain"),
    ("skatt", "domain"),
    ("budget", "domain"),
    ("uppföljning", "domain"),
    ("kundservice", "domain"),
    ("försäljning", "domain"),
    ("inköp", "domain"),
    ("lager", "domain"),
    ("logistik", "domain"),
    ("integrationer", "domain"),
    ("affärssystem", "domain"),
    ("kvalitetssäkring", "domain"),
    ("arbetsmiljö", "domain"),
    ("HR", "domain"),
    ("rekrytering", "domain"),
    ("Agile", "domain"),
    ("Scrum", "domain"),
    ("ITIL", "domain"),
]

LANGUAGE_TERMS: list[tuple[str, str]] = [
    ("svenska", "languages"),
    ("engelska", "languages"),
    ("tyska", "languages"),
    ("franska", "languages"),
    ("spanska", "languages"),
]

ALL_TERMS = sorted(
    TOOL_TERMS + DOMAIN_TERMS + LANGUAGE_TERMS,
    key=lambda pair: -len(pair[0]),
)

# Too vague to help annons matching.
GENERIC_SKIP = frozenset(
    {
        "ansvar",
        "drift",
        "kontor",
        "support",
        "operations",
        "proaktiv",
        "effektiv",
        "skalbar",
        "växande",
        "kontinuerlig",
        "koordinator",
        "partner",
        "extern",
        "intern",
    }
)


def _experience_text(row: dict) -> str:
    parts = [
        row.get("title") or "",
        row.get("company") or "",
        row.get("description") or "",
    ]
    return "\n".join(part.strip() for part in parts if part and str(part).strip())


def _source_label(index: int, row: dict) -> str:
    title = str(row.get("title") or "").strip()
    if title:
        return f"Erfarenhet {index + 1}: {title}"
    return f"Erfarenhet {index + 1}"


def _find_terms(text: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    seen: set[str] = set()
    for label, category in ALL_TERMS:
        lowered = label.lower()
        if lowered in seen or lowered in GENERIC_SKIP:
            continue
        if _skill_pattern(label).search(text):
            seen.add(lowered)
            found.append((label, category))
    return found


def suggest_skills_from_experience(
    experience: list,
    *,
    existing_groups: dict | None = None,
) -> dict[str, list[dict]]:
    """Return new skill suggestions grouped by category with source attribution."""
    if not isinstance(experience, list):
        return {key: [] for key in SKILL_GROUP_KEYS}

    existing_lower = {
        skill.lower()
        for skill in flatten_skill_groups(normalize_skill_groups(existing_groups or {}))
    }
    suggestions: dict[str, list[dict]] = {key: [] for key in SKILL_GROUP_KEYS}
    seen = set(existing_lower)

    for index, row in enumerate(experience):
        if not isinstance(row, dict):
            continue
        text = _experience_text(row)
        if len(text) < 15:
            continue
        source = _source_label(index, row)
        for label, category in _find_terms(text):
            lowered = canonical_skill_label(label).lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            suggestions[category].append({"label": canonical_skill_label(label), "source": source})

    return suggestions


def has_skill_suggestions(suggestions: dict[str, list]) -> bool:
    return any(suggestions.get(key) for key in SKILL_GROUP_KEYS)


def _categorize_parsed_skill(label: str) -> str:
    """Best-effort bucket for free-text CV skills."""
    lowered = label.lower()
    for term, category in ALL_TERMS:
        if lowered == term.lower():
            return category
    if len(label.split()) <= 3:
        return "domain"
    return "technical"


def skills_list_to_suggestions(
    skills: list[str],
    *,
    source: str,
    existing_groups: dict | None = None,
) -> dict[str, list[dict]]:
    """Turn parsed CV skills into reviewable suggestions (not auto-saved)."""
    existing_lower = {
        skill.lower()
        for skill in flatten_skill_groups(normalize_skill_groups(existing_groups or {}))
    }
    suggestions: dict[str, list[dict]] = {key: [] for key in SKILL_GROUP_KEYS}
    seen = set(existing_lower)

    for raw in skills:
        if not isinstance(raw, str):
            continue
        label = canonical_skill_label(raw)
        if not label:
            continue
        lowered = label.lower()
        if lowered in seen or lowered in GENERIC_SKIP:
            continue
        seen.add(lowered)
        category = _categorize_parsed_skill(label)
        suggestions[category].append({"label": label, "source": source})

    return suggestions


def merge_skill_suggestions(*parts: dict[str, list]) -> dict[str, list[dict]]:
    """Merge suggestion dicts without duplicate labels."""
    merged: dict[str, list[dict]] = {key: [] for key in SKILL_GROUP_KEYS}
    seen: set[str] = set()
    for part in parts:
        if not isinstance(part, dict):
            continue
        for key in SKILL_GROUP_KEYS:
            for item in part.get(key, []):
                if not isinstance(item, dict):
                    continue
                label = canonical_skill_label(str(item.get("label") or ""))
                if not label:
                    continue
                lowered = label.lower()
                if lowered in seen:
                    continue
                seen.add(lowered)
                merged[key].append(
                    {
                        "label": label,
                        "source": str(item.get("source") or "").strip() or "CV",
                    }
                )
    return merged


def _education_text(row: dict) -> str:
    return "\n".join(
        part.strip()
        for part in (
            str(row.get("degree") or ""),
            str(row.get("school") or ""),
            str(row.get("years") or ""),
        )
        if part and str(part).strip()
    )


def suggest_evidence_by_source(
    experience: list,
    education: list | None = None,
    *,
    profile_evidence: list[dict] | None = None,
    parsed_skills: list[str] | None = None,
) -> dict[str, list[dict]]:
    """Suggest evidence keyed by source id (experience:0, education:1, cv_section)."""
    existing_lower = {
        str(item.get("term") or "").lower()
        for item in (profile_evidence or [])
        if item.get("term")
    }
    by_source: dict[str, list[dict]] = {}
    seen = set(existing_lower)

    for index, row in enumerate(experience or []):
        if not isinstance(row, dict):
            continue
        text = _experience_text(row)
        if len(text) < 15:
            continue
        key = f"experience:{index}"
        items: list[dict] = []
        for label, category in _find_terms(text):
            term = canonical_skill_label(label)
            lowered = term.lower()
            if lowered in seen or lowered in GENERIC_SKIP:
                continue
            seen.add(lowered)
            items.append({"term": term, "category": category})
        if items:
            by_source[key] = items

    for index, row in enumerate(education or []):
        if not isinstance(row, dict):
            continue
        text = _education_text(row)
        if len(text) < 8:
            continue
        key = f"education:{index}"
        items = []
        for label, category in _find_terms(text):
            term = canonical_skill_label(label)
            lowered = term.lower()
            if lowered in seen or lowered in GENERIC_SKIP:
                continue
            seen.add(lowered)
            items.append({"term": term, "category": category})
        if items:
            by_source[key] = items

    if parsed_skills:
        items = []
        for raw in parsed_skills:
            if not isinstance(raw, str):
                continue
            term = canonical_skill_label(raw)
            if not term:
                continue
            lowered = term.lower()
            if lowered in seen or lowered in GENERIC_SKIP:
                continue
            seen.add(lowered)
            category = _categorize_parsed_skill(term)
            items.append({"term": term, "category": category})
        if items:
            by_source["cv_section"] = items

    return by_source
