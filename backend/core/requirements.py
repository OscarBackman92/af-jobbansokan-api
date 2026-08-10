"""Requirement extraction and coverage scoring for CV ↔ job matching.

Rule-based and explainable: ads are split into lines, classified as must
or merit from Swedish cue words, then scored against the user's evidence
terms. The score denominator is the ad's requirements — never the size
of the CV.
"""

from __future__ import annotations

import re
from types import SimpleNamespace

from .skill_canonical import (
    _CANONICAL_GROUPS,
    canonical_skill_label,
)

MUST_CUES = (
    "krav",
    "vi kräver",
    "du har",
    "du ska",
    "du måste",
    "vi söker dig som",
    "du besitter",
    "det krävs",
    "kvalifikationer",
)
MERIT_CUES = (
    "meriterande",
    "är ett plus",
    "gärna",
    "fördel om",
    "önskvärt",
    "ser vi positivt",
    "extra plus",
)
BOILERPLATE_HEADERS = (
    "om oss",
    "om företaget",
    "vi erbjuder",
    "ansökan",
    "så här söker du",
    "villkor",
)

_LIST_PREFIX = re.compile(r"^\s*(?:[-•*]|\d+[.)])\s+")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-ZÅÄÖ])")


def _known_labels(extra_terms: list[str] | None = None) -> list[str]:
    labels = [canonical for canonical, _ in _CANONICAL_GROUPS]
    for term in extra_terms or []:
        text = canonical_skill_label(term)
        if text and text not in labels:
            labels.append(text)
    return labels


def _is_header(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) >= 60:
        return False
    if stripped.endswith((".", "!", "?")):
        return False
    return True


def _line_level(line: str, inherited: str) -> str:
    lowered = line.casefold()
    if any(cue in lowered for cue in MERIT_CUES):
        return "merit"
    if any(cue in lowered for cue in MUST_CUES):
        return "must"
    return inherited


def _is_boilerplate_header(line: str) -> bool:
    lowered = line.casefold().strip(" :")
    return any(header in lowered for header in BOILERPLATE_HEADERS)


def _split_description(description: str) -> list[tuple[int, str]]:
    """Return (1-based source line index, text) pairs."""
    if not description:
        return []
    raw_lines = description.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    rows: list[tuple[int, str]] = []
    for index, raw in enumerate(raw_lines, start=1):
        line = _LIST_PREFIX.sub("", raw).strip()
        if not line:
            continue
        if "\n" not in description and len(raw_lines) == 1:
            for sentence in _SENTENCE_SPLIT.split(line):
                sentence = sentence.strip()
                if sentence:
                    rows.append((index, sentence))
        else:
            rows.append((index, line))
    return rows


def _terms_in_text(text: str, labels: list[str]) -> list[str]:
    from .matching import _terms_hit_text

    found: list[str] = []
    seen: set[str] = set()
    for label in labels:
        if _terms_hit_text(label, text):
            key = label.casefold()
            if key in seen:
                continue
            seen.add(key)
            found.append(label)
    return found


def extract_requirements(
    posting, *, extra_terms: list[str] | None = None
) -> list[dict]:
    """Extract must/merit requirements from posting title + description."""
    title = getattr(posting, "title", "") or ""
    description = getattr(posting, "description", "") or ""
    labels = _known_labels(extra_terms)
    results: dict[str, dict] = {}

    def add_hit(term: str, level: str, snippet: str, source_line: int) -> None:
        key = term.casefold()
        existing = results.get(key)
        if existing and existing["level"] == "must":
            return
        if existing and level == "merit":
            return
        results[key] = {
            "term": term,
            "level": level,
            "snippet": snippet[:120],
            "source_line": source_line,
        }

    # Title terms are must unless clearly meriting.
    for term in _terms_in_text(title, labels):
        add_hit(term, "must", title.strip()[:120], 0)

    inherited = "must"
    skipping_boilerplate = False
    for source_line, line in _split_description(description):
        if _is_header(line):
            if _is_boilerplate_header(line):
                # Skip "Om oss" / "Vi erbjuder" sections unless the header
                # itself carries a requirement cue.
                if not any(cue in line.casefold() for cue in MUST_CUES + MERIT_CUES):
                    skipping_boilerplate = True
                    continue
            skipping_boilerplate = False
            inherited = _line_level(line, inherited)
            # Header may also name a skill.
            level = inherited
            for term in _terms_in_text(line, labels):
                add_hit(term, level, line, source_line)
            continue

        if skipping_boilerplate:
            continue

        level = _line_level(line, inherited)
        for term in _terms_in_text(line, labels):
            add_hit(term, level, line, source_line)

    return list(results.values())


def _band(score: int | None, *, confidence: str) -> str:
    if confidence == "low" or score is None:
        return "unknown"
    if score >= 70:
        return "strong"
    if score >= 40:
        return "medium"
    if score > 0:
        return "weak"
    return "weak"


def _term_covered(term: str, evidence_by_term: dict[str, dict]) -> dict | None:
    key = canonical_skill_label(term).casefold()
    return evidence_by_term.get(key)


def score_posting(
    evidence_or_terms,
    posting,
    *,
    formal: list[dict] | None = None,
) -> dict:
    """Score coverage of extracted ad requirements against CV evidence/terms."""
    if evidence_or_terms and isinstance(evidence_or_terms[0], dict):
        evidence = [
            item
            for item in evidence_or_terms
            if item.get("confirmed", True) and item.get("term")
        ]
        cv_terms = [item["term"] for item in evidence]
        evidence_by_term = {
            canonical_skill_label(item["term"]).casefold(): item for item in evidence
        }
    else:
        evidence = []
        cv_terms = [t for t in (evidence_or_terms or []) if str(t).strip()]
        evidence_by_term = {
            canonical_skill_label(term).casefold(): {
                "term": term,
                "source": {},
            }
            for term in cv_terms
        }

    requirements = extract_requirements(posting, extra_terms=cv_terms)
    description = getattr(posting, "description", "") or ""
    title = getattr(posting, "title", "") or ""
    full_text = f"{title}\n{description}"

    covered: list[dict] = []
    gaps: list[dict] = []
    must_total = merit_total = must_covered = merit_covered = 0

    for req in requirements:
        level = req["level"]
        if level == "must":
            must_total += 1
        else:
            merit_total += 1
        hit = _term_covered(req["term"], evidence_by_term)
        if hit:
            if level == "must":
                must_covered += 1
            else:
                merit_covered += 1
            covered.append(
                {
                    "term": req["term"],
                    "level": level,
                    "snippet": req["snippet"],
                    "source": hit.get("source") or {},
                }
            )
        else:
            gaps.append(
                {
                    "term": req["term"],
                    "level": level,
                    "snippet": req["snippet"],
                }
            )

    # CV terms the ad never mentions — informational, not "missing".
    from .matching import _terms_hit_text

    unused_cv_terms = [
        term for term in cv_terms if not _terms_hit_text(term, full_text)
    ]

    confidence = "high"
    if len(description.strip()) < 200:
        confidence = "low"
    elif must_total > 0 and must_total < 4:
        # Thin requirement lists inflate raw coverage — keep them neutral.
        confidence = "low"
    elif must_total == 0 and merit_total < 3:
        confidence = "low"

    # Shrinkage: never report 100% on a tiny requirement set.
    if must_total > 0:
        raw_score = 100 * must_covered / (must_total + 2)
        score = int(round(raw_score))
    elif merit_total > 0:
        raw_score = 100 * merit_covered / (merit_total + 2)
        score = int(round(raw_score))
    else:
        score = None

    band = _band(score, confidence=confidence)

    # Backward-compatible keys: count/total now mean requirement coverage.
    if must_total > 0:
        count, total = must_covered, must_total
    elif merit_total > 0:
        count, total = merit_covered, merit_total
    else:
        count, total = 0, 0

    matched = [item["term"] for item in covered]
    # "missing" = uncovered must/merit requirements (not unused CV terms).
    missing = [item["term"] for item in gaps]

    return {
        "must_total": must_total,
        "must_covered": must_covered,
        "merit_total": merit_total,
        "merit_covered": merit_covered,
        "score": score if confidence == "high" else None,
        "band": band,
        "confidence": confidence,
        "covered": covered,
        "gaps": gaps,
        "unused_cv_terms": unused_cv_terms,
        "formal": formal or [],
        "matched": matched,
        "missing": missing,
        "matched_detail": [
            {"term": item["term"], "source": item.get("source") or {}}
            for item in covered
        ],
        "count": count,
        "total": total,
        "cv_terms_used": len(cv_terms) - len(unused_cv_terms),
        "cv_terms_total": len(cv_terms),
    }


def posting_like_from_application(application) -> SimpleNamespace:
    """Build a posting-like object from a tracker row (prefer ad_description)."""
    parts = []
    ad_description = getattr(application, "ad_description", "") or ""
    if ad_description:
        parts.append(ad_description)
    posting = getattr(application, "posting", None)
    if posting is not None and getattr(posting, "description", None):
        parts.append(posting.description)
    notes = getattr(application, "notes", "") or ""
    if notes:
        parts.append(notes)
    return SimpleNamespace(
        title=getattr(application, "title", "") or "",
        description="\n".join(parts),
    )


def score_application(evidence_or_terms, application, *, formal=None) -> dict:
    return score_posting(
        evidence_or_terms,
        posting_like_from_application(application),
        formal=formal,
    )


def score_all_profiles(resume, posting) -> list[dict]:
    """Score a posting against every job profile on the resume."""
    from .job_profiles import (
        confirmed_evidence,
        normalize_job_profiles,
        profile_skill_terms,
    )

    try:
        profiles = normalize_job_profiles(
            getattr(resume, "job_profiles", None) or [],
            headline=getattr(resume, "headline", "") or "",
        )
    except ValueError:
        profiles = []
    if not profiles:
        return []

    scored = []
    for profile in profiles:
        evidence = confirmed_evidence(profile)
        terms = profile_skill_terms(profile)
        result = score_posting(evidence or terms, posting)
        scored.append(
            {
                "profile_id": str(profile.get("id") or ""),
                "label": profile.get("label") or "Profil",
                "score": result.get("score"),
                "band": result.get("band") or "unknown",
                "confidence": result.get("confidence") or "low",
            }
        )
    scored.sort(
        key=lambda row: (
            row["score"] is not None,
            row["score"] if row["score"] is not None else -1,
        ),
        reverse=True,
    )
    return scored


def trim_snapshot(result: dict) -> dict:
    """Persistable slice of a score_posting result."""
    return {
        "must_total": result.get("must_total", 0),
        "must_covered": result.get("must_covered", 0),
        "merit_total": result.get("merit_total", 0),
        "merit_covered": result.get("merit_covered", 0),
        "score": result.get("score"),
        "band": result.get("band"),
        "confidence": result.get("confidence"),
        "covered": (result.get("covered") or [])[:12],
        "gaps": (result.get("gaps") or [])[:12],
        "unused_cv_terms": (result.get("unused_cv_terms") or [])[:12],
        "formal": result.get("formal") or [],
        "cv_terms_used": result.get("cv_terms_used", 0),
        "cv_terms_total": result.get("cv_terms_total", 0),
    }
