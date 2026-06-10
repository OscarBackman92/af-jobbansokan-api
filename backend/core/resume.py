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
}

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(\+?\d[\d \-]{7,}\d)")


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


def parse_resume_text(text: str) -> dict:
    """Best-effort mapping of free CV text to the structured resume form.

    Sections are detected by common Swedish/English headings; everything
    before the first heading becomes headline + summary. The result is a
    draft for the user to review — not a final truth.
    """
    email_match = EMAIL_RE.search(text)
    phone_match = PHONE_RE.search(text)

    buckets = {"summary": [], "skills": [], "experience": [], "education": []}
    current = "summary"
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        heading = line.lower().rstrip(":").strip()
        matched = next(
            (
                section
                for section, names in SECTION_HEADINGS.items()
                if heading in names
            ),
            None,
        )
        if matched:
            current = matched
            continue
        buckets[current].append(line)

    summary_lines = [
        line
        for line in buckets["summary"]
        if not EMAIL_RE.search(line) and not PHONE_RE.search(line)
    ]
    headline = summary_lines[0] if summary_lines else ""

    skills: list[str] = []
    for line in buckets["skills"]:
        skills.extend(
            part.strip(" •-–\t")
            for part in re.split(r"[,;•|]", line)
            if part.strip(" •-–\t")
        )

    return {
        "headline": headline,
        "summary": "\n".join(summary_lines[1:]),
        "skills": skills,
        "experience": [
            {"title": line, "company": "", "years": "", "description": ""}
            for line in buckets["experience"]
        ],
        "education": [
            {"school": line, "degree": "", "years": ""} for line in buckets["education"]
        ],
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
    }
