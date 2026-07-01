"""CV text extraction and heuristic parsing.

Uploaded files are parsed in memory and never written to disk — only the
structured draft is returned, and nothing is persisted until the user
reviews and saves the form.
"""

from __future__ import annotations

import io
import re

import docx
import pypdf

MAX_UPLOAD_SIZE = 2 * 1024 * 1024  # 2 MB
SUPPORTED_EXTENSIONS = (".pdf", ".docx", ".txt")

SECTION_HEADINGS = {
    "profile": {
        "profil",
        "profile",
        "om mig",
        "about me",
        "personligt brev",
    },
    "skills": {
        "kompetenser",
        "färdigheter",
        "skills",
        "tekniker",
        "teknisk kompetens",
        "kunskaper",
    },
    "experience": {
        "erfarenhet",
        "arbetslivserfarenhet",
        "experience",
        "work experience",
        "anställningar",
        "tidigare anställningar",
        "yrkeserfarenhet",
    },
    "education": {
        "utbildning",
        "utbildningar",
        "education",
        "kurser",
    },
    "ignore": {
        "egenskaper",
        "personliga egenskaper",
        "referenser",
        "references",
        "språk",
        "languages",
        "körkort",
        "övrigt",
        "kontakt",
        "contact",
        "intressen",
    },
}

# Longest first, so "arbetslivserfarenhet" wins over "erfarenhet".
_HEADINGS_BY_LENGTH = sorted(
    ((name, section) for section, names in SECTION_HEADINGS.items() for name in names),
    key=lambda pair: -len(pair[0]),
)

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+46|0)\d[\d \-]{6,}\d(?!\d)")
LINKEDIN_RE = re.compile(r"\blinkedin\b", re.IGNORECASE)

_MONTH = (
    r"(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober"
    r"|november|december|january|february|march|may|june|july|august|october"
    r"|jan|feb|mar|apr|jun|jul|aug|sep|okt|oct|nov|dec)"
)
_DATE = rf"(?:{_MONTH}\.?\s+)?(?:19|20)\d{{2}}"
_ONGOING = r"(?:pågående|nuvarande|present|ongoing|idag|nu)"
DATE_RANGE_RE = re.compile(
    rf"^{_DATE}\s*[–—-]\s*(?:{_DATE}|{_ONGOING})\s*$", re.IGNORECASE
)
DATE_RANGE_SEARCH_RE = re.compile(
    rf"{_DATE}\s*[–—-]\s*(?:{_DATE}|{_ONGOING})\b", re.IGNORECASE
)
YEAR_ONLY_RE = re.compile(r"^(?:19|20)\d{2}$")
LEADING_YEAR_RE = re.compile(r"^((?:19|20)\d{2})\s+(.+)$")
TRAILING_YEARS_RE = re.compile(
    r"^(.*?)[,]?\s*((?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?)$"
)
EDU_EM_DASH_RE = re.compile(
    r"^(.+?)\s+[—–-]\s+(.+?),\s*((?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?)\s*$"
)
EDU_EM_DASH_TAIL_RE = re.compile(
    r"^[—–-]\s*(.+?),\s*((?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?)\s*$"
)
BULLET_RE = re.compile(r"^[•·▪*]\s*|^\s{2,}[–\-]\s+")
INLINE_BULLET_RE = re.compile(r"\s+[•·▪]\s+")
PAGE_NUMBER_RE = re.compile(r"^\d{1,3}$")
WHITESPACE_RE = re.compile(r"\s+")
COLUMN_GAP_RE = re.compile(r"\s{4,}")
# Layout PDFs indent the right column heavily; below this is usually the left column.
RIGHT_COLUMN_INDENT = 55


def _clean(text: str) -> str:
    """Collapse whitespace runs — pypdf often doubles every space."""
    return WHITESPACE_RE.sub(" ", text).strip()


def extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from a PDF, DOCX or TXT upload."""
    name = filename.lower()
    if name.endswith(".pdf"):
        reader = pypdf.PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text(extraction_mode="layout") or "")
            except Exception:
                pages.append(page.extract_text() or "")
        return "\n".join(pages)
    if name.endswith(".docx"):
        document = docx.Document(io.BytesIO(data))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    if name.endswith(".txt"):
        return data.decode("utf-8", errors="replace")
    raise ValueError(f"Unsupported file type: {filename}")


def _split_line_columns(raw_line: str) -> tuple[str, str]:
    """Split a layout-extracted PDF line into left and right column text."""
    if not raw_line or not raw_line.strip():
        return "", ""
    stripped = raw_line.strip()
    indent = raw_line.find(stripped)
    if indent >= RIGHT_COLUMN_INDENT:
        return "", stripped

    parts = [part.strip() for part in COLUMN_GAP_RE.split(raw_line) if part.strip()]
    if len(parts) == 2:
        return parts[0], parts[1]
    return stripped, ""


def _match_heading(line: str) -> tuple[str | None, str]:
    """Return (section, rest-of-line) if the line starts with a heading."""
    normalized = line.lower().strip()
    for name, section in _HEADINGS_BY_LENGTH:
        if normalized == name:
            return section, ""
        if not normalized.startswith(name):
            continue
        rest = line[len(name) :]
        if not rest.strip(" :\t") or rest.lstrip(" :\t").startswith(
            ("•", "·", "|", "-", "–")
        ):
            return section, rest.strip(" :•·|–-\t")
        # "Erfarenhet av ledarskap" is prose, not a section heading.
        if rest.strip() and rest.strip()[0].islower():
            return None, ""
    return None, ""


def _looks_like_name(line: str) -> bool:
    words = line.split()
    if not words or len(words) > 4 or any(char.isdigit() for char in line):
        return False
    if _match_heading(line)[0]:
        return False
    if len(words) == 1:
        word = words[0]
        if word.isupper():
            return False
        return word[0].isupper() and word.isalpha()
    if all(word.isupper() for word in words):
        return False
    return all(word[0].isupper() for word in words)


JOB_TITLE_HINTS = {
    "operations",
    "coordinator",
    "administratör",
    "administrator",
    "developer",
    "engineer",
    "manager",
    "assistent",
    "assistant",
    "order",
    "ekonomi",
    "business",
    "orderadministratör",
    "ekonomiassistent",
    "praktik",
    "fullstack",
}


TRAIT_MARKERS = ("orienterad", "inriktad", "lärd", "analytisk", "nyfiken")


def _looks_like_trait(line: str) -> bool:
    text = _clean(line).lower()
    words = text.split()
    if not words or len(words) > 3 or DATE_RANGE_SEARCH_RE.search(text):
        return False
    if any(char.isdigit() for char in text):
        return False
    if any(hint in text for hint in JOB_TITLE_HINTS):
        return False
    return any(marker in text for marker in TRAIT_MARKERS)


def _looks_like_title_line(line: str) -> bool:
    text = _clean(line)
    if not text or _match_heading(text)[0]:
        return False
    if text.endswith((".", "!", "?")):
        return False
    words = text.split()
    if not words or len(words) > 6:
        return False
    if len(words) <= 3 and all(word.isupper() for word in words):
        if not any(hint in word.lower() for word in words for hint in JOB_TITLE_HINTS):
            return False
    upperish = sum(1 for word in words if word.isupper() or word[:1].isupper())
    return upperish >= max(1, len(words) - 1)


def _looks_like_prose(line: str) -> bool:
    text = _clean(line)
    if len(text) > 90:
        return True
    words = text.split()
    if len(words) >= 8:
        return True
    return bool(re.search(r"\b(och|att|för|med|som|jag|det|en|av)\b", text.lower()))


def _split_title_company(text: str) -> tuple[str, str]:
    """Split "TITLE, Company" or "TITLE  COMPANY" when a wide gap separates them."""
    if not text or not text.strip():
        return "", ""
    gap_parts = re.split(r"\s{2,}", text.strip(), maxsplit=1)
    if len(gap_parts) == 2:
        return _clean(gap_parts[0]), _clean(gap_parts[1])

    text = _clean(text)
    double_gaps = len(re.findall(r"\S {2,}", text))
    single_gaps = len(re.findall(r"\S \S", text))
    if double_gaps == 1 or (double_gaps == 2 and single_gaps > double_gaps):
        parts = re.split(r"\s{2,}", text, maxsplit=1)
        return _clean(parts[0]), _clean(parts[1])
    # Only split on comma when the right side looks like a company, not prose.
    if ", " in text and not _looks_like_prose(text):
        left, right = text.rsplit(", ", 1)
        if len(right.split()) <= 6 and not right[0].islower():
            return _clean(left), _clean(right)
    return text, ""


def _infer_headline(text: str) -> str:
    """Pick a job-title line from the top of a linear CV (before any section)."""
    for raw_line in text.splitlines():
        line = _clean(raw_line)
        if not line:
            continue
        if _match_heading(line)[0]:
            break
        if _looks_like_name(line) or _is_contact_line(line):
            continue
        words = line.split()
        if words and len(words) <= 4 and all(word.isupper() for word in words):
            continue
        if len(line.split()) <= 10 and not line.endswith((".", "!", "?")):
            return line
        break
    return ""


def _is_contact_line(line: str) -> bool:
    lowered = line.lower()
    return bool(
        EMAIL_RE.search(line)
        or PHONE_RE.search(line)
        or LINKEDIN_RE.search(line)
        or lowered in {"stockholm, sverige", "stockholm"}
        or lowered.startswith("stockholm,")
    )


def _bucket_lines(text: str) -> dict[str, list[str]]:
    """Route layout-aware lines into logical CV sections."""
    buckets: dict[str, list[str]] = {
        "summary": [],
        "skills": [],
        "experience": [],
        "education": [],
        "ignore": [],
    }
    left_mode: str | None = "profile"
    right_mode: str | None = None
    profile_title_parts: list[str] = []

    def append(section: str | None, line: str) -> None:
        if section and line:
            buckets[section].append(line)

    for raw_line in text.splitlines():
        if not raw_line.strip() or PAGE_NUMBER_RE.match(raw_line.strip()):
            continue

        left, right = _split_line_columns(raw_line)
        for part, side in ((left, "left"), (right, "right")):
            if not part:
                continue

            section, rest = _match_heading(part)
            if section:
                if side == "left":
                    left_mode = section
                    if section in ("education", "profile"):
                        right_mode = section
                else:
                    right_mode = section
                append(section, rest)
                continue

            mode = left_mode if side == "left" else right_mode
            if (
                side == "left"
                and mode in (None, "profile")
                and right_mode == "experience"
            ):
                mode = "experience"
            if side == "left" and mode in (None, "profile") and left_mode == "skills":
                mode = "skills"
            if side == "right" and mode is None and left_mode == "profile":
                mode = "profile"
            if side == "right" and left_mode == "skills" and _looks_like_skill(part):
                mode = "skills"

            if mode == "skills" and side == "left":
                left_col, _ = _split_line_columns(raw_line)
                parts = [p.strip() for p in COLUMN_GAP_RE.split(left_col) if p.strip()]
                if len(parts) > 1:
                    for chunk in parts:
                        if _looks_like_prose(chunk) or _looks_like_trait(chunk):
                            break
                        append("skills", chunk)
                    continue

            if mode == "profile":
                if _looks_like_name(part) or _is_contact_line(part):
                    continue
                if side == "left" and _looks_like_title_line(part):
                    profile_title_parts.append(part)
                    continue
                if side == "right" or _looks_like_prose(part):
                    append("summary", part)
                continue

            if mode == "ignore":
                if _is_contact_line(part) or _match_heading(part)[0]:
                    continue
                if (
                    right_mode == "experience"
                    and not _looks_like_trait(part)
                    and (
                        DATE_RANGE_RE.match(_clean(part))
                        or DATE_RANGE_SEARCH_RE.search(_clean(part))
                        or _looks_like_title_line(part)
                        or (len(_clean(part).split()) <= 4 and _clean(part).isupper())
                    )
                ):
                    mode = "experience"
                else:
                    continue

            if mode in {None, "profile"} and _is_contact_line(part):
                continue
            append(mode, part)

    buckets["_profile_title_parts"] = profile_title_parts
    return buckets


def _parse_experience(lines: list[str]) -> list[dict]:
    """One row per job; bullets and wrapped lines become descriptions."""
    rows: list[dict] = []
    pending_date = ""

    def new_row() -> dict:
        row = {"title": "", "company": "", "years": "", "description": ""}
        rows.append(row)
        return row

    def add_description(text: str) -> None:
        if not rows or not text:
            return
        current = rows[-1]["description"]
        if current and text[:1].islower():
            rows[-1]["description"] = f"{current} {text}"
        else:
            rows[-1]["description"] = f"{current}\n{text}" if current else text

    for raw in lines:
        for segment in INLINE_BULLET_RE.split(raw):
            line = BULLET_RE.sub("", segment)
            if not _clean(line) or _match_heading(_clean(line))[0]:
                continue

            cleaned = _clean(line)
            if _is_contact_line(cleaned) or LINKEDIN_RE.search(cleaned):
                continue
            if DATE_RANGE_RE.match(cleaned):
                pending_date = cleaned
                continue

            date_match = DATE_RANGE_SEARCH_RE.search(cleaned)
            if date_match:
                if date_match.start() == 0:
                    pending_date = _clean(date_match.group(0))
                    remainder = _clean(cleaned[date_match.end() :])
                    if remainder:
                        row = new_row()
                        row["years"] = pending_date
                        row["title"], row["company"] = _split_title_company(remainder)
                        pending_date = ""
                    continue
                if date_match.end() >= len(cleaned.rstrip()):
                    row = new_row()
                    row["years"] = _clean(date_match.group(0))
                    row["title"], row["company"] = _split_title_company(
                        cleaned[: date_match.start()]
                    )
                    pending_date = ""
                    continue

            if BULLET_RE.match(segment) or (
                rows and rows[-1]["title"] and cleaned[:1].islower()
            ):
                add_description(cleaned)
                continue

            if pending_date:
                row = new_row()
                row["years"] = pending_date
                row["title"], row["company"] = _split_title_company(line)
                pending_date = ""
                if row["company"]:
                    continue
                continue

            if rows and rows[-1]["title"] and not rows[-1]["company"]:
                rows[-1]["company"] = cleaned
                continue

            if _looks_like_prose(cleaned):
                add_description(cleaned)
                continue

            if rows and rows[-1]["title"] and not rows[-1]["description"]:
                rows[-1]["company"] = cleaned
                continue

            row = new_row()
            row["title"], row["company"] = _split_title_company(line)

    return [row for row in rows if row["title"] or row["company"] or row["years"]]


def _education_entry(text: str, pending_years: str) -> dict:
    text = _clean(text)
    em_match = EDU_EM_DASH_RE.match(text)
    if em_match:
        return {
            "degree": _clean(em_match.group(1)),
            "school": _clean(em_match.group(2)),
            "years": _clean(em_match.group(3)),
        }
    if "|" in text:
        degree, _, rhs = text.partition("|")
        match = TRAILING_YEARS_RE.match(rhs.strip())
        school, years = (
            (match.group(1).strip(), match.group(2)) if match else (rhs.strip(), "")
        )
        return {
            "school": _clean(school),
            "degree": _clean(degree),
            "years": _clean(years) or pending_years,
        }
    years = ""
    match = TRAILING_YEARS_RE.match(text)
    if match and match.group(1).strip():
        text, years = match.group(1).strip(), match.group(2)
    degree, school = "", text
    gap_parts = re.split(r"\s{2,}", text, maxsplit=1)
    if len(gap_parts) == 2 and len(re.findall(r"\S {2,}", text)) <= 2:
        degree, school = gap_parts
    elif ", " in text:
        degree, school = text.rsplit(", ", 1)
    return {
        "school": _clean(school),
        "degree": _clean(degree),
        "years": _clean(years) or pending_years,
    }


def _parse_education(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    pending_years = ""
    pending_degree = ""
    pending_em_degree = ""

    for raw in lines:
        for segment in INLINE_BULLET_RE.split(raw):
            raw_line = BULLET_RE.sub("", segment)
            line = _clean(raw_line)
            if not line:
                continue
            if "övriga utbildning" in line.lower():
                continue
            if _match_heading(line)[0]:
                continue

            tail_match = EDU_EM_DASH_TAIL_RE.match(line)
            if tail_match:
                degree = pending_em_degree or pending_degree
                if degree:
                    rows.append(
                        {
                            "degree": _clean(degree),
                            "school": _clean(tail_match.group(1)),
                            "years": _clean(tail_match.group(2)),
                        }
                    )
                    pending_em_degree = ""
                    pending_degree = ""
                    pending_years = ""
                continue

            em_match = EDU_EM_DASH_RE.match(line)
            if em_match:
                rows.append(_education_entry(line, pending_years))
                pending_years = ""
                pending_degree = ""
                pending_em_degree = ""
                continue

            if YEAR_ONLY_RE.match(line):
                pending_years = line
                pending_em_degree = ""
                continue

            year_match = LEADING_YEAR_RE.match(line)
            if year_match:
                pending_years, line = year_match.group(1), year_match.group(2)
                pending_em_degree = ""

            if line[0].islower() or line.endswith((".", "!", "?")):
                continue
            if line.lower().startswith(("diplom", "betyg:", "praktisk")):
                continue
            if (len(line) > 90 or len(line.split()) > 10) and _looks_like_prose(line):
                continue

            if pending_years and not pending_degree:
                degree, school = _split_title_company(raw_line)
                if school:
                    rows.append(
                        {
                            "degree": _clean(degree),
                            "school": _clean(school),
                            "years": pending_years,
                        }
                    )
                    pending_years = ""
                    pending_em_degree = ""
                else:
                    pending_degree = line
                    pending_em_degree = ""
                continue

            if pending_years and pending_degree:
                rows.append(
                    {
                        "degree": _clean(pending_degree),
                        "school": _clean(line),
                        "years": pending_years,
                    }
                )
                pending_years = ""
                pending_degree = ""
                pending_em_degree = ""
                continue

            if not pending_years:
                entry = _education_entry(line, "")
                if entry["degree"] and entry["school"]:
                    rows.append(entry)
                    pending_em_degree = ""
                    continue
                pending_em_degree = line
                continue

            entry = _education_entry(line, pending_years)
            if entry["school"] or entry["degree"]:
                rows.append(entry)
                pending_years = ""
                pending_degree = ""
                pending_em_degree = ""

    if pending_degree and pending_years:
        rows.append({"degree": pending_degree, "school": "", "years": pending_years})
    return rows


def _looks_like_skill(part: str) -> bool:
    part = _clean(part)
    if not part or len(part) > 45 or len(part.split()) > 5:
        return False
    if part.endswith(".") or _looks_like_prose(part) or _looks_like_trait(part):
        return False
    return True


def _parse_skills(lines: list[str]) -> list[str]:
    skills: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if _looks_like_prose(line):
            continue
        for part in re.split(r"[,;•·|]|\s{2,}", line):
            part = _clean(part.strip(" •·-–\t"))
            if (
                not part
                or part.isdigit()
                or not _looks_like_skill(part)
                or part.lower() in seen
                or _match_heading(part)[0]
            ):
                continue
            seen.add(part.lower())
            skills.append(part)
    return skills


def parse_resume_text(text: str) -> dict:
    """Best-effort mapping of free CV text to the structured resume form."""
    email_match = EMAIL_RE.search(text)
    phone_match = PHONE_RE.search(text)

    buckets = _bucket_lines(text)
    profile_title_parts = buckets.pop("_profile_title_parts", [])

    headline = _clean(" ".join(profile_title_parts))
    if headline.isupper():
        headline = headline.title()
    if not headline:
        headline = _infer_headline(text)
    if not headline:
        summary_candidates = buckets["summary"][:]
        if summary_candidates and _looks_like_title_line(summary_candidates[0]):
            headline = summary_candidates[0]
            summary_candidates = summary_candidates[1:]

    summary_lines = [
        _clean(line)
        for line in buckets["summary"]
        if not EMAIL_RE.search(line)
        and not PHONE_RE.search(line)
        and not LINKEDIN_RE.search(line)
        and not _looks_like_name(line)
        and not _looks_like_title_line(line)
        and line.lower().strip() not in {"stockholm, sverige", "stockholm"}
    ]

    return {
        "headline": headline,
        "summary": _clean(" ".join(summary_lines)),
        "skills": _parse_skills(buckets["skills"]),
        "experience": _parse_experience(buckets["experience"]),
        "education": _parse_education(buckets["education"]),
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
    }
