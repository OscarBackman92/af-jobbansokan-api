import io
from pathlib import Path

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
    assert body["skill_groups"] == {"technical": [], "domain": [], "languages": []}
    assert Resume.objects.filter(user=user).exists()


def test_put_saves_structured_resume(api_client, user):
    api_client.force_authenticate(user)
    payload = {
        "headline": "Backendutvecklare",
        "summary": "Fem års erfarenhet av Python.",
        "skill_groups": {
            "technical": ["Python", "Django", " PostgreSQL "],
            "domain": ["Agile"],
            "languages": ["Svenska"],
        },
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
    assert body["skills"] == ["Python", "Django", "PostgreSQL", "Agile", "Svenska"]
    assert body["skill_groups"]["technical"] == ["Python", "Django", "PostgreSQL"]
    assert body["experience"][0]["company"] == "Acme AB"


def test_invalid_skill_groups_rejected(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.put(
        URL, {"skill_groups": {"technical": [{"namn": "Python"}]}}, format="json"
    )
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
    assert draft["skill_groups"]["technical"] == draft["skills"]
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


# Verbatim pypdf layout-mode output (abbreviated): indented blocks, a
# date line above each "TITLE  COMPANY" line, wrapped bullet
# continuations, page numbers, and a two-column section at the end.
REAL_PDF_TEXT = """                    OSCAR BÄCKMAN

                                                        0720101647
                                       Jan.oscar.backman@gmail.com · LinkedIn


Jag  är  en snabblärd och       strukturerad person        som   trivs i rollen som spindeln i        nätet.  Jag  gillar  att
samarbeta, lösa problem och förbättra rutiner.

ARBETSLIVSERFARENHET

     FEBRUARI 2026 – PÅGÅENDE
     BUSINESS OPERATIONS COORDINATOR  ADNS HOUSE OF SERVICE AB
          •  Central roll med ansvar för ekonomi, administration och uppföljning för House of Service IT
             och FM, med fokus på effektiva och skalbara processer.
          •  Operativt ansvar för kund- och leverantörsfakturor.

     NOVEMBER 2018 – OKTOBER 2025
     ORDERADMINISTRATÖR  AVOKI GROUP AB
          •  Hanterade försäljningsorder inom IT och AV.

     SEPTEMBER 2017 – NOVEMBER 2018
     EKONOMIASSISTENT  AVOKI
          •  Hanterade fakturering och kreditering i Visma Business.

     JUNI 2017 – AUGUSTI 2017

                                                              1
    EKONOMIASSISTENT (PRAKTIK)  IMG SWEDEN AB
         •  Assisterade i löpande ekonomiuppgifter, fakturering och rapportering.

UTBILDNING

    2024
    FULLSTACK DEVELOPMENT  CODE INSTITUTE
         •  Diplom i Full Stack Software Development med fokus på avancerad frontend.
         •  Praktisk erfarenhet av moderna utvecklingsverktyg och ramverk som React, Node.js och
            Django.
         •  Betyg: Pass

    Övriga utbildningar
         •  MS Teams och SharePoint för administratörer | Informator, 2022
         •  Tekniskt gymnasium | Värmdö Tekniska Gymnasium, 2010 - 2013

KOMPETENSER                                                   EGENSKAPER
•   SuperOffice CRM                                            •  Lösningsorienterad
•   Visma Business ERP                                         •  Serviceinriktad
•   Office                                                     •  Nyfiken/Snabblärd
•   Nettailer/Netset
•   B-körkort

REFERENSER
    Lämnas på förfrågan

                                                           2
"""


def test_parse_realistic_pdf_extraction():
    """Verbatim pypdf layout-mode output must map cleanly to the form."""
    draft = parse_resume_text(REAL_PDF_TEXT)

    # The name is not a headline; the prose goes to summary as one block.
    assert draft["headline"] == ""
    assert "snabblärd och strukturerad person" in draft["summary"]
    assert "\n" not in draft["summary"]

    assert [
        (row["title"], row["company"], row["years"]) for row in draft["experience"]
    ] == [
        (
            "BUSINESS OPERATIONS COORDINATOR",
            "ADNS HOUSE OF SERVICE AB",
            "FEBRUARI 2026 – PÅGÅENDE",
        ),
        ("ORDERADMINISTRATÖR", "AVOKI GROUP AB", "NOVEMBER 2018 – OKTOBER 2025"),
        ("EKONOMIASSISTENT", "AVOKI", "SEPTEMBER 2017 – NOVEMBER 2018"),
        ("EKONOMIASSISTENT (PRAKTIK)", "IMG SWEDEN AB", "JUNI 2017 – AUGUSTI 2017"),
    ]
    # Wrapped bullet lines are joined back into the description.
    assert (
        "för House of Service IT och FM, med fokus"
        in draft["experience"][0]["description"]
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

    # Left column lands in skills, right column (traits) is ignored…
    assert draft["skills"] == [
        "SuperOffice CRM",
        "Visma Business ERP",
        "Office",
        "Nettailer/Netset",
        "B-körkort",
    ]
    # …and traits/references/page numbers stay out of everything.
    flat = str(draft)
    assert "Lösningsorienterad" not in flat
    assert "Lämnas på förfrågan" not in flat
    assert "Övriga" not in flat


OSCAR_CV_TEXT = (
    Path(__file__)
    .parent.joinpath("fixtures", "oscar-backman-cv-extracted.txt")
    .read_text(encoding="utf-8")
)


def test_parse_oscar_backman_canva_cv():
    """Two-column Canva PDF layout (verbatim pypdf output) must parse cleanly."""
    draft = parse_resume_text(OSCAR_CV_TEXT)

    assert draft["headline"] == "Business Operations Coordinator"
    assert "snabblärd och strukturerad person" in draft["summary"]
    assert draft["email"] == "Jan.oscar.backman@gmail.com"
    assert draft["phone"] == "072-010 16 47"

    assert draft["skills"] == [
        "SuperOffice CRM",
        "Visma Business ERP",
        "Wint",
        "Nettailer/Netset",
        "SharePoint",
        "Office",
        "Power BI (grunder)",
        "VS Code",
        "GitHub",
        "Claude (AI)",
        "B-körkort",
    ]

    assert [
        (row["title"], row["company"], row["years"]) for row in draft["experience"]
    ] == [
        (
            "Business Operations Coordinator",
            "ADNS House of Service AB",
            "FEBRUARI 2026 - JULI 2026",
        ),
        ("Orderadministratör", "AVOKI Group AB", "NOVEMBER 2018 – OKTOBER 2025"),
        ("Ekonomiassistent", "AVOKI", "SEPTEMBER 2017 – NOVEMBER 2018"),
        ("Ekonomiassistent (praktik)", "IMG Sweden AB", "JUNI 2017 – AUGUSTI 2017"),
    ]

    assert draft["education"] == [
        {
            "degree": "Fullstack Development",
            "school": "Code Institute",
            "years": "2024",
        },
        {
            "degree": "MS Teams & SharePoint för administratörer",
            "school": "Informator",
            "years": "2022",
        },
        {
            "degree": "Certifierad Ekonomiassistent",
            "school": "Påhlmans Handelsinstitut",
            "years": "2017",
        },
        {
            "degree": "Ekonomiutbildning",
            "school": "Komvux Värmdö",
            "years": "2014",
        },
        {
            "degree": "Tekniskt gymnasium",
            "school": "Värmdö Tekniska Gymnasium",
            "years": "2010–2013",
        },
    ]


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
