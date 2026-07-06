import pytest
from core.experience_skills import suggest_evidence_by_source

pytestmark = pytest.mark.django_db


FINANCE_EXPERIENCE = [
    {
        "title": "Ekonomiassistent",
        "company": "Acme AB",
        "years": "2020–2024",
        "description": (
            "Kontering och attest av leverantörsfakturor i Wint. "
            "Månadsbokslut och avstämning."
        ),
    }
]


def test_suggest_evidence_by_experience_row():
    by_source = suggest_evidence_by_source(FINANCE_EXPERIENCE, [])
    assert "experience:0" in by_source
    terms = {item["term"].lower() for item in by_source["experience:0"]}
    assert "wint" in terms
    assert "kontering" in terms


def test_suggest_skips_existing_profile_evidence():
    by_source = suggest_evidence_by_source(
        FINANCE_EXPERIENCE,
        [],
        profile_evidence=[
            {
                "term": "Wint",
                "category": "technical",
                "confirmed": True,
                "source": {"type": "manual", "index": None, "label": "Manuellt"},
            }
        ],
    )
    terms = {item["term"].lower() for item in by_source.get("experience:0", [])}
    assert "wint" not in terms
