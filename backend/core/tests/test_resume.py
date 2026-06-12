import io

import docx
import pytest
from core import resume as resume_module
from core.models import Resume
from core.resume import parse_resume_text
from django.core.files.uploadedfile import SimpleUploadedFile

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/resume/"
PARSE_URL = "/api/v1/me/resume/parse/"

CV_TEXT = """Anna Svensson
Backendutvecklare med fem års erfarenhet
anna@example.com
070-123 45 67

Kompetenser:
Python, Django • PostgreSQL; Docker

Erfarenhet
Backendutvecklare, Acme AB 2021-2024
Systemutvecklare, Initech 2019-2021

Utbildning
Systemvetenskap, Lunds universitet
"""


def test_resume_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


def test_get_creates_empty_resume(api_client, user):
    api_client.force_authenticate(user)
    body = api_client.get(URL).json()
    assert body["headline"] == ""
    assert body["skills"] == []
    assert Resume.objects.filter(user=user).exists()


def test_put_saves_structured_resume(api_client, user):
    api_client.force_authenticate(user)
    payload = {
        "headline": "Backendutvecklare",
        "summary": "Fem års erfarenhet av Python.",
        "skills": ["Python", "Django", " PostgreSQL "],
        "experience": [
            {
                "title": "Backendutvecklare",
                "company": "Acme AB",
                "years": "2021-2024",
                "description": "API-utveckling.",
            }
        ],
        "education": [
            {"school": "Lunds universitet", "degree": "Systemvetenskap", "years": ""}
        ],
    }
    response = api_client.put(URL, payload, format="json")
    assert response.status_code == 200

    body = api_client.get(URL).json()
    assert body["headline"] == "Backendutvecklare"
    assert body["skills"] == ["Python", "Django", "PostgreSQL"]
    assert body["experience"][0]["company"] == "Acme AB"


def test_invalid_skills_rejected(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.put(URL, {"skills": [{"namn": "Python"}]}, format="json")
    assert response.status_code == 400


def test_unknown_experience_fields_rejected(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.put(URL, {"experience": [{"lön": "mycket"}]}, format="json")
    assert response.status_code == 400


def test_parse_resume_text_sections():
    draft = parse_resume_text(CV_TEXT)
    # The person's name is not a headline; the title line below it is.
    assert draft["headline"] == "Backendutvecklare med fem års erfarenhet"
    assert draft["skills"] == ["Python", "Django", "PostgreSQL", "Docker"]
    assert [
        (row["title"], row["company"], row["years"]) for row in draft["experience"]
    ] == [
        ("Backendutvecklare", "Acme AB", "2021-2024"),
        ("Systemutvecklare", "Initech", "2019-2021"),
    ]
    assert draft["education"] == [
        {"school": "Lunds universitet", "degree": "Systemvetenskap", "years": ""}
    ]
    assert draft["email"] == "anna@example.com"
    assert draft["phone"] == "070-123 45 67"
    # Contact lines never leak into the summary.
    assert "anna@example.com" not in draft["summary"]


REAL_PDF_TEXT = """OSCAR BÄCKMAN
0720101647
Jan.oscar.backman@gmail.com · LinkedIn
Jag är en snabblärd och strukturerad person som trivs i rollen.

ARBETSLIVSERFARENHET
FEBRUARI 2026 – PÅGÅENDE
BUSINESS OPERATIONS COORDINATOR  ADNS HOUSE OF SERVICE AB
• Central roll med ansvar för ekonomi.
• Operativt ansvar för kund- och leverantörsfakturor.
NOVEMBER 2018 – OKTOBER 2025
ORDERADMINISTRATÖR  AVOKI GROUP AB
• Hanterade försäljningsorder.
1
UTBILDNING
2024
FULLSTACK DEVELOPMENT  CODE INSTITUTE
• Diplom i Full Stack Software Development.
Övriga utbildningar
• MS Teams och SharePoint för administratörer | Informator, 2022
• Tekniskt gymnasium | Värmdö Tekniska Gymnasium, 2010 - 2013
KOMPETENSER • SuperOffice CRM • Visma Business ERP • Office
EGENSKAPER
• Lösningsorienterad
REFERENSER
Lämnas på förfrågan
2
"""


def test_parse_realistic_pdf_extraction():
    """Text as pypdf actually produces it: date ranges on their own lines,
    page numbers, two-column sections glued together, trailing sections
    (EGENSKAPER, REFERENSER) that must not pollute the form."""
    draft = parse_resume_text(REAL_PDF_TEXT)

    # The name is not a headline; the prose line is summary, not headline.
    assert draft["headline"] == ""
    assert "snabblärd" in draft["summary"]

    assert [
        (row["title"], row["company"], row["years"]) for row in draft["experience"]
    ] == [
        (
            "BUSINESS OPERATIONS COORDINATOR",
            "ADNS HOUSE OF SERVICE AB",
            "FEBRUARI 2026 – PÅGÅENDE",
        ),
        ("ORDERADMINISTRATÖR", "AVOKI GROUP AB", "NOVEMBER 2018 – OKTOBER 2025"),
    ]
    assert (
        "Central roll med ansvar för ekonomi." in draft["experience"][0]["description"]
    )

    assert draft["education"] == [
        {
            "school": "CODE INSTITUTE",
            "degree": "FULLSTACK DEVELOPMENT",
            "years": "2024",
        },
        {
            "school": "Informator",
            "degree": "MS Teams och SharePoint för administratörer",
            "years": "2022",
        },
        {
            "school": "Värmdö Tekniska Gymnasium",
            "degree": "Tekniskt gymnasium",
            "years": "2010 - 2013",
        },
    ]

    # The glued two-column heading still lands in skills…
    assert draft["skills"] == ["SuperOffice CRM", "Visma Business ERP", "Office"]
    # …and traits/references/page numbers stay out of everything.
    flat = str(draft)
    assert "Lösningsorienterad" not in flat
    assert "Lämnas på förfrågan" not in flat


def test_parse_txt_upload(api_client, user):
    api_client.force_authenticate(user)
    upload = SimpleUploadedFile("cv.txt", CV_TEXT.encode(), "text/plain")
    response = api_client.post(PARSE_URL, {"file": upload}, format="multipart")
    assert response.status_code == 200
    assert response.json()["skills"] == ["Python", "Django", "PostgreSQL", "Docker"]


def test_parse_docx_upload(api_client, user):
    document = docx.Document()
    for line in CV_TEXT.splitlines():
        document.add_paragraph(line)
    buffer = io.BytesIO()
    document.save(buffer)

    api_client.force_authenticate(user)
    upload = SimpleUploadedFile("cv.docx", buffer.getvalue())
    response = api_client.post(PARSE_URL, {"file": upload}, format="multipart")
    assert response.status_code == 200
    assert response.json()["headline"] == "Backendutvecklare med fem års erfarenhet"


def test_parse_pdf_upload(api_client, user, monkeypatch):
    # Generating a text PDF needs heavier tooling; the pdf branch of
    # extract_text is exercised with the extraction itself stubbed.
    monkeypatch.setattr(
        resume_module.pypdf,
        "PdfReader",
        lambda _stream: type(
            "FakeReader",
            (),
            {"pages": [type("FakePage", (), {"extract_text": lambda self: CV_TEXT})()]},
        )(),
    )
    api_client.force_authenticate(user)
    upload = SimpleUploadedFile("cv.pdf", b"%PDF-1.4 fake")
    response = api_client.post(PARSE_URL, {"file": upload}, format="multipart")
    assert response.status_code == 200
    assert response.json()["email"] == "anna@example.com"


def test_parse_rejects_unsupported_type(api_client, user):
    api_client.force_authenticate(user)
    upload = SimpleUploadedFile("cv.exe", b"MZ")
    response = api_client.post(PARSE_URL, {"file": upload}, format="multipart")
    assert response.status_code == 400


def test_parse_rejects_oversized_file(api_client, user, monkeypatch):
    monkeypatch.setattr(resume_module, "MAX_UPLOAD_SIZE", 10)
    monkeypatch.setattr("core.views.MAX_UPLOAD_SIZE", 10)
    api_client.force_authenticate(user)
    upload = SimpleUploadedFile("cv.txt", b"x" * 11)
    response = api_client.post(PARSE_URL, {"file": upload}, format="multipart")
    assert response.status_code == 400


def test_corrupt_pdf_gives_400(api_client, user):
    api_client.force_authenticate(user)
    upload = SimpleUploadedFile("cv.pdf", b"not a pdf at all")
    response = api_client.post(PARSE_URL, {"file": upload}, format="multipart")
    assert response.status_code == 400
