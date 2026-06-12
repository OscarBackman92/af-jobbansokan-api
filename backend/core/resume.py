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
TRAILING_YEARS_RE = re.compile(
    r"^(.*?)[,]?\s*((?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?)$"
)
BULLET_RE = re.compile(r"^[•·▪*]\s*|^[–\-]\s+")
PAGE_NUMBER_RE = re.compile(r"^\d{1,3}$")


def extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from a PDF, DOCX or TXT upload."""
    name = filename.lower()
    if name.endswith(".pdf"):
        reader = pypdf.PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
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

    PDF extraction tends to keep a wider gap between separately styled
    runs (title vs employer), which survives as multiple spaces.
    """
    parts = re.split(r"\s{2,}", text, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    if ", " in text:
        title, company = text.rsplit(", ", 1)
        return title.strip(), company.strip()
    return text.strip(), ""


def _parse_experience(lines: list[str]) -> list[dict]:
    rows: list[dict] = []

    def new_row() -> dict:
        rows.append({"title": "", "company": "", "years": "", "description": ""})
        return rows[-1]

    for line in lines:
        if BULLET_RE.match(line):
            if rows:
                text = BULLET_RE.sub("", line).strip()
                current = rows[-1]["description"]
                rows[-1]["description"] = f"{current}\n{text}" if current else text
            continue
        match = DATE_RANGE_RE.search(line)
        if match:
            row = new_row()
            row["years"] = match.group(0)
            remainder = (line[: match.start()] + " " + line[match.end() :]).strip(
                " ,–—-"
            )
            if remainder:
                row["title"], row["company"] = _split_title_company(remainder)
            continue
        if rows and not rows[-1]["title"]:
            rows[-1]["title"], rows[-1]["company"] = _split_title_company(line)
        elif (
            rows
            and rows[-1]["title"]
            and not rows[-1]["company"]
            and not rows[-1]["description"]
        ):
            rows[-1]["company"] = line
        else:
            row = new_row()
            row["title"], row["company"] = _split_title_company(line)
    return rows


def _parse_education(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    pending_years = ""

    for line in lines:
        text = BULLET_RE.sub("", line).strip()
        if "övriga utbildning" in text.lower():
            continue
        if YEAR_ONLY_RE.match(text):
            pending_years = text
            continue
        if "|" in text:
            # "Kursnamn | Skola, 2022"
            degree, _, rhs = text.partition("|")
            match = TRAILING_YEARS_RE.match(rhs.strip())
            school, years = (
                (match.group(1).strip(), match.group(2)) if match else (rhs.strip(), "")
            )
            rows.append(
                {
                    "school": school,
                    "degree": degree.strip(),
                    "years": years or pending_years,
                }
            )
            pending_years = ""
            continue
        if BULLET_RE.match(line):
            continue  # description bullet under an entry
        match = TRAILING_YEARS_RE.match(text)
        years = ""
        if match and match.group(1).strip():
            text, years = match.group(1).strip(), match.group(2)
        degree, school = "", text
        gap_parts = re.split(r"\s{2,}", text, maxsplit=1)
        if len(gap_parts) == 2:
            degree, school = gap_parts
        elif ", " in text:
            degree, school = text.rsplit(", ", 1)
        rows.append(
            {
                "school": school.strip(),
                "degree": degree.strip(),
                "years": years or pending_years,
            }
        )
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
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or PAGE_NUMBER_RE.match(line):
            continue
        section, rest = _match_heading(line)
        if section:
            current = section
            if rest:
                buckets[current].append(rest)
            continue
        buckets[current].append(line)

    summary_lines = [
        line
        for line in buckets["summary"]
        if not EMAIL_RE.search(line)
        and not PHONE_RE.search(line)
        and line.lower() != "linkedin"
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
            part = part.strip(" •·-–\t")
            if part and not part.isdigit() and len(part) <= 60:
                skills.append(part)

    return {
        "headline": headline,
        "summary": "\n".join(summary_lines),
        "skills": skills,
        "experience": _parse_experience(buckets["experience"]),
        "education": _parse_education(buckets["education"]),
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
    }
