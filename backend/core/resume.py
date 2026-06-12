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
    },
    "education": {
        "utbildning",
        "utbildningar",
        "education",
        "kurser",
    },
    # Common CV sections that don't map to the form and would otherwise
    # pollute whatever section preceded them.
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
PHONE_RE = re.compile(r"(\+?\d[\d \-]{7,}\d)")

_MONTH = (
    r"(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober"
    r"|november|december|january|february|march|may|june|july|august|october"
    r"|jan|feb|mar|apr|jun|jul|aug|sep|okt|oct|nov|dec)"
)
_DATE = rf"(?:{_MONTH}\.?\s+)?(?:19|20)\d{{2}}"
_ONGOING = r"(?:pågående|nuvarande|present|ongoing|idag|nu)"
DATE_RANGE_RE = re.compile(
    rf"{_DATE}\s*[–—-]\s*(?:{_DATE}|{_ONGOING})\b", re.IGNORECASE
)
YEAR_ONLY_RE = re.compile(r"^(?:19|20)\d{2}$")
LEADING_YEAR_RE = re.compile(r"^((?:19|20)\d{2})\s+(.+)$")
TRAILING_YEARS_RE = re.compile(
    r"^(.*?)[,]?\s*((?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?)$"
)
BULLET_RE = re.compile(r"^[•·▪*]\s*|^[–\-]\s+")
INLINE_BULLET_RE = re.compile(r"\s+[•·▪]\s+")
PAGE_NUMBER_RE = re.compile(r"^\d{1,3}$")
WHITESPACE_RE = re.compile(r"\s+")
COLUMN_GAP_RE = re.compile(r"\s{4,}")


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
            # Layout mode preserves line breaks and column gaps, which the
            # parser depends on; plain mode glues whole sections together.
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


def _match_heading(line: str) -> tuple[str | None, str]:
    """Return (section, rest-of-line) if the line starts with a heading.

    PDF extraction often glues a heading to its content (two-column
    layouts, styled runs), so "KOMPETENSER • Python" must still switch
    section. A heading followed by a regular word ("Erfarenhet av X")
    is content, not a heading.
    """
    normalized = line.lower()
    for name, section in _HEADINGS_BY_LENGTH:
        if not normalized.startswith(name):
            continue
        rest = line[len(name) :]
        if not rest.strip(" :\t") or rest.lstrip(" :\t").startswith(
            ("•", "·", "|", "-", "–")
        ):
            return section, rest.strip(" :•·|–-\t")
    return None, ""


def _looks_like_name(line: str) -> bool:
    words = line.split()
    return (
        1 < len(words) <= 4
        and not any(char.isdigit() for char in line)
        and all(word[0].isupper() for word in words)
    )


def _split_title_company(text: str) -> tuple[str, str]:
    """Split "Backendutvecklare, Acme AB" / "TITLE  COMPANY" style lines.

    A wider gap between separately styled runs (title vs employer) can
    survive extraction as multiple spaces — but only trust it when it is
    the exception: some PDFs double *every* space, and splitting on the
    first such gap would cut the title in half mid-word.
    """
    double_gaps = len(re.findall(r"\S {2,}", text))
    single_gaps = len(re.findall(r"\S \S", text))
    if double_gaps == 1 or (double_gaps == 2 and single_gaps > double_gaps):
        parts = re.split(r"\s{2,}", text, maxsplit=1)
        return _clean(parts[0]), _clean(parts[1])
    if ", " in text:
        title, company = text.rsplit(", ", 1)
        return _clean(title), _clean(company)
    return _clean(text), ""


def _parse_experience(lines: list[str]) -> list[dict]:
    """One row per position.

    PDF extraction may deliver a whole position as a single line:
    "<date range> <TITLE> <COMPANY> • bullet • bullet …" — so inline
    bullets are split off as description before the head is parsed.
    """
    rows: list[dict] = []

    def new_row() -> dict:
        rows.append({"title": "", "company": "", "years": "", "description": ""})
        return rows[-1]

    def add_description(parts: list[str]) -> None:
        parts = [part for part in parts if part]
        if not rows or not parts:
            return
        current = rows[-1]["description"]
        joined = "\n".join(parts)
        rows[-1]["description"] = f"{current}\n{joined}" if current else joined

    for line in lines:
        segments = INLINE_BULLET_RE.split(line)
        if BULLET_RE.match(line):
            add_description([_clean(BULLET_RE.sub("", seg)) for seg in segments])
            continue
        head = segments[0].strip()
        descriptions = [_clean(seg) for seg in segments[1:]]

        match = DATE_RANGE_RE.search(head)
        if match:
            row = new_row()
            row["years"] = _clean(match.group(0))
            remainder = (head[: match.start()] + " " + head[match.end() :]).strip(
                " ,–—-"
            )
            if remainder:
                row["title"], row["company"] = _split_title_company(remainder)
        elif head and head[0].islower() and rows and rows[-1]["description"]:
            # Wrapped continuation of the previous bullet line.
            rows[-1]["description"] += " " + _clean(head)
        elif rows and not rows[-1]["title"]:
            rows[-1]["title"], rows[-1]["company"] = _split_title_company(head)
        elif head:
            row = new_row()
            row["title"], row["company"] = _split_title_company(head)
        add_description(descriptions)
    return rows


def _education_entry(text: str, pending_years: str) -> dict:
    """Build one education row from "Kursnamn | Skola, 2022"-style text."""
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
    """One row per school/course.

    Inline bullets can be either real entries ("• Kurs | Skola, 2022")
    or descriptions under an entry — only the former become rows.
    """
    rows: list[dict] = []
    pending_years = ""

    for line in lines:
        segments = INLINE_BULLET_RE.split(line)
        starts_with_bullet = bool(BULLET_RE.match(line))
        head = None if starts_with_bullet else segments[0].strip()
        bullet_parts = segments if starts_with_bullet else segments[1:]

        if head:
            head = BULLET_RE.sub("", head).strip()
            if "övriga utbildning" in _clean(head).lower():
                head = ""
            # Wrapped bullet continuations and stray prose are not
            # entries; school names don't start lowercase or end in ".".
            elif head[0].islower() or head.endswith((".", "!", "?")):
                head = ""
        if head:
            if YEAR_ONLY_RE.match(head):
                pending_years = head
            else:
                year_match = LEADING_YEAR_RE.match(head)
                if year_match:
                    pending_years, head = year_match.group(1), year_match.group(2)
                rows.append(_education_entry(head, pending_years))
                pending_years = ""

        for part in bullet_parts:
            part = _clean(BULLET_RE.sub("", part))
            if "|" in part:  # a real entry; plain bullets are descriptions
                rows.append(_education_entry(part, pending_years))
                pending_years = ""
    return rows


def parse_resume_text(text: str) -> dict:
    """Best-effort mapping of free CV text to the structured resume form.

    Sections are detected by common Swedish/English headings; everything
    before the first heading becomes headline + summary. The result is a
    draft for the user to review — not a final truth.
    """
    email_match = EMAIL_RE.search(text)
    phone_match = PHONE_RE.search(text)

    buckets: dict[str, list[str]] = {
        "summary": [],
        "skills": [],
        "experience": [],
        "education": [],
        "ignore": [],
    }
    current = "summary"
    # Layout extraction renders side-by-side sections ("KOMPETENSER
    # EGENSKAPER") as one heading line followed by item pairs; track the
    # per-column section so each item lands in the right bucket.
    column_sections: list[str] | None = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or PAGE_NUMBER_RE.match(line):
            continue

        segments = [seg.strip() for seg in COLUMN_GAP_RE.split(line) if seg.strip()]
        segment_headings = [_match_heading(seg) for seg in segments]
        if len(segments) >= 2 and all(sec for sec, _ in segment_headings):
            column_sections = [sec for sec, _ in segment_headings]
            current = column_sections[0]
            for sec, rest in segment_headings:
                if rest:
                    buckets[sec].append(rest)
            continue
        if column_sections and len(segments) >= 2:
            # Columns can have unequal length; pair what lines up.
            for sec, seg in zip(column_sections, segments, strict=False):
                buckets[sec].append(seg)
            continue
        if column_sections and BULLET_RE.match(line):
            buckets[column_sections[0]].append(segments[0])
            continue

        section, rest = _match_heading(line)
        if section:
            current = section
            column_sections = None
            if rest:
                buckets[current].append(rest)
            continue
        buckets[current].append(line)

    summary_lines = [
        _clean(line)
        for line in buckets["summary"]
        if not EMAIL_RE.search(line)
        and not PHONE_RE.search(line)
        and line.lower().strip() != "linkedin"
    ]
    # The first line is usually the person's name, not a headline.
    if summary_lines and _looks_like_name(summary_lines[0]):
        summary_lines = summary_lines[1:]
    headline = ""
    if (
        summary_lines
        and len(summary_lines[0]) <= 60
        and not summary_lines[0].endswith((".", "!", "?"))
    ):
        headline = summary_lines[0]
        summary_lines = summary_lines[1:]

    skills: list[str] = []
    for line in buckets["skills"]:
        for part in re.split(r"[,;•·|]", line):
            part = _clean(part.strip(" •·-–\t"))
            if part and not part.isdigit() and len(part) <= 60:
                skills.append(part)

    return {
        "headline": headline,
        # Summary is prose; PDF extraction may deliver one word per line,
        # so join with spaces rather than preserving line breaks.
        "summary": _clean(" ".join(summary_lines)),
        "skills": skills,
        "experience": _parse_experience(buckets["experience"]),
        "education": _parse_education(buckets["education"]),
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
    }
