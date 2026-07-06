"""Canonical skill labels and match aliases — keeps lists tidy and matching useful."""

from __future__ import annotations

# (canonical label, aliases). Aliases are matched case-insensitively.
_CANONICAL_GROUPS: list[tuple[str, list[str]]] = [
    ("Excel", ["excel", "microsoft excel", "ms excel"]),
    (
        "Microsoft 365",
        ["microsoft 365", "m365", "office 365", "microsoft office", "ms office"],
    ),
    ("Power BI", ["power bi", "powerbi"]),
    ("SharePoint", ["sharepoint", "microsoft sharepoint"]),
    ("Word", ["word", "microsoft word", "ms word"]),
    ("Outlook", ["outlook", "microsoft outlook"]),
    ("Teams", ["teams", "microsoft teams"]),
    ("SQL", ["sql", "tsql", "t-sql"]),
    ("PostgreSQL", ["postgresql", "postgres"]),
    ("JavaScript", ["javascript", "js"]),
    ("TypeScript", ["typescript", "ts"]),
    ("C#", ["c#", "csharp", "c sharp"]),
    (".NET", [".net", "dotnet", "asp.net", "aspnet"]),
    ("Node.js", ["node.js", "nodejs", "node"]),
    ("GitHub", ["github"]),
    ("GitLab", ["gitlab"]),
    ("Python", ["python"]),
    ("Django", ["django"]),
    ("React", ["react", "react.js", "reactjs"]),
    ("Docker", ["docker"]),
    ("Kubernetes", ["kubernetes", "k8s"]),
    ("SAP", ["sap"]),
    ("Fortnox", ["fortnox"]),
    ("Visma", ["visma"]),
    ("Wint", ["wint"]),
    ("Agile", ["agile", "agilt arbetssätt"]),
    ("Scrum", ["scrum"]),
    ("Projektledning", ["projektledning", "projektledare"]),
    ("Inköp", ["inköp", "inkop"]),
    ("Upphandling", ["upphandling", "upphandlare"]),
    ("Bokföring", ["bokföring", "bokforing", "bokförare"]),
    ("Redovisning", ["redovisning"]),
    ("Svenska", ["svenska", "swedish"]),
    ("Engelska", ["engelska", "english"]),
]

_ALIAS_TO_CANONICAL: dict[str, str] = {}
_CANONICAL_TO_ALIASES: dict[str, list[str]] = {}

for canonical, aliases in _CANONICAL_GROUPS:
    canonical = canonical.strip()
    all_forms = [canonical, *aliases]
    unique_forms: list[str] = []
    seen: set[str] = set()
    for form in all_forms:
        text = form.strip()
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_forms.append(text)
        _ALIAS_TO_CANONICAL[lowered] = canonical
    _CANONICAL_TO_ALIASES[canonical.lower()] = unique_forms


def canonical_skill_label(label: str) -> str:
    """Map synonyms to one stored label (e.g. Microsoft Excel → Excel)."""
    text = label.strip()
    if not text:
        return ""
    return _ALIAS_TO_CANONICAL.get(text.lower(), text)


def skill_match_terms(label: str) -> list[str]:
    """All text forms to search for when matching a skill against annons text."""
    text = canonical_skill_label(label)
    if not text:
        return []
    forms = _CANONICAL_TO_ALIASES.get(text.lower(), [text])
    return forms
