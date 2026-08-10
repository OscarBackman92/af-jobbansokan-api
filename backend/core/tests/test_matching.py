from types import SimpleNamespace

import pytest
from core.matching import legacy_cv_coverage, match_skills
from core.models import JobPosting
from core.requirements import extract_requirements, score_posting

pytestmark = pytest.mark.django_db


@pytest.fixture
def python_posting(db):
    return JobPosting.objects.create(
        title="Backendutvecklare",
        company_name="Acme AB",
        description="Vi arbetar med Python, Django och PostgreSQL.",
    )


def test_match_skills_covers_ad_requirements(python_posting):
    result = match_skills(["python", "React", "PostgreSQL"], python_posting)
    assert result["must_total"] >= 2
    assert "Python" in result["matched"] or "python" in [
        t.casefold() for t in result["matched"]
    ]
    assert result["count"] == result["must_covered"]
    assert result["total"] == result["must_total"]
    assert "React" in result["unused_cv_terms"] or any(
        t.casefold() == "react" for t in result["unused_cv_terms"]
    )


def test_extract_requirements_must_vs_merit():
    posting = SimpleNamespace(
        title="Ekonomiassistent",
        description="\n".join(
            [
                "Krav",
                "- Du har erfarenhet av Bokföring",
                "- Goda kunskaper i Excel",
                "Meriterande",
                "- Erfarenhet av Fortnox är ett plus",
                "- Gärna Power BI",
                "Om oss",
                "Vi är ett fint bolag som använder SAP internt.",
            ]
        ),
    )
    reqs = extract_requirements(posting)
    by_term = {r["term"]: r["level"] for r in reqs}
    assert by_term.get("Bokföring") == "must"
    assert by_term.get("Excel") == "must"
    assert by_term.get("Fortnox") == "merit"
    assert by_term.get("Power BI") == "merit"
    # Boilerplate section should not contribute SAP as a requirement.
    assert "SAP" not in by_term


def test_merit_header_inherits_level():
    posting = SimpleNamespace(
        title="Controller",
        description="\n".join(
            [
                "Meriterande:",
                "- Redovisning",
                "- Visma",
            ]
        ),
    )
    reqs = extract_requirements(posting)
    assert all(r["level"] == "merit" for r in reqs)
    assert {r["term"] for r in reqs} >= {"Redovisning", "Visma"}


def test_score_falls_back_to_merit_when_no_must():
    posting = SimpleNamespace(
        title="Praktikant",
        description="\n".join(
            [
                "Meriterande",
                "- Excel",
                "- Power BI",
                "- SQL",
                ("Extra bakgrundstext om rollen. " * 20),
            ]
        ),
    )
    result = score_posting(["Excel", "Power BI", "SQL"], posting)
    assert result["must_total"] == 0
    assert result["merit_total"] >= 3
    assert result["confidence"] == "high"
    # Shrinkage: 3/5 = 60, not raw 100%.
    assert result["score"] == 60
    assert result["band"] == "medium"


def test_low_confidence_when_few_must_requirements():
    posting = SimpleNamespace(
        title="Rehab",
        description="\n".join(
            [
                "Krav",
                "- Excel",
                "- Svenska",
                ("Lång beskrivning av uppdraget. " * 30),
            ]
        ),
    )
    result = score_posting(["Excel", "Svenska"], posting)
    assert result["must_total"] == 2
    assert result["must_covered"] == 2
    assert result["confidence"] == "low"
    assert result["score"] is None
    assert result["band"] == "unknown"


def test_low_confidence_when_description_short():
    posting = SimpleNamespace(title="Utvecklare", description="Python.")
    result = score_posting(["Python"], posting)
    assert result["confidence"] == "low"
    assert result["score"] is None
    assert result["band"] == "unknown"


def test_unused_cv_terms_do_not_affect_score():
    posting = SimpleNamespace(
        title="Backend",
        description=("Krav\n- Python\n- Django\n" + ("Lång beskrivning. " * 40)),
    )
    result = score_posting(["Python", "Fortnox", "Wint"], posting)
    assert "Fortnox" in result["unused_cv_terms"] or any(
        t.casefold() == "fortnox" for t in result["unused_cv_terms"]
    )
    assert result["must_covered"] >= 1
    assert "Fortnox" not in result["missing"]


def test_prefix_match_upphandlingar():
    posting = SimpleNamespace(
        title="Upphandlare",
        description="\n".join(
            [
                "Krav",
                "- Erfarenhet av upphandlingar",
                "- Goda kunskaper i Excel",
                "- Svenska i tal och skrift",
                "- Power BI",
                ("Beskrivning av uppdraget. " * 25),
            ]
        ),
    )
    result = score_posting(["Upphandling", "Excel", "Svenska", "Power BI"], posting)
    assert result["must_covered"] >= 1
    assert any(c["term"] == "Upphandling" for c in result["covered"])
    assert result["must_total"] >= 4
    assert result["confidence"] == "high"


def test_boundary_guards_still_hold():
    # Django must not count as covering a "Go" CV term via substring.
    posting = SimpleNamespace(
        title="Backend",
        description=("Krav\n- Django\n" + ("Beskrivning. " * 40)),
    )
    result = score_posting(["Go"], posting)
    assert result["must_covered"] == 0
    assert any(g["term"] == "Django" for g in result["gaps"])

    # Thailand must not create an AI requirement hit for CV term AI.
    legacy = legacy_cv_coverage(
        ["AI"],
        SimpleNamespace(title="Guide", description="Semester i Thailand"),
    )
    assert legacy["matched"] == []


def test_score_all_profiles_sorts_desc():
    from types import SimpleNamespace

    from core.job_profiles import empty_profile
    from core.requirements import score_all_profiles

    ekonomi = empty_profile(label="Ekonomi", active=False)
    ekonomi["evidence"] = [
        {
            "id": "e1",
            "term": "Excel",
            "category": "technical",
            "confirmed": True,
            "source": {"type": "manual", "index": None, "label": ""},
        }
    ]
    it_support = empty_profile(label="IT-support", active=True)
    it_support["evidence"] = [
        {
            "id": "e2",
            "term": "Python",
            "category": "technical",
            "confirmed": True,
            "source": {"type": "manual", "index": None, "label": ""},
        },
        {
            "id": "e3",
            "term": "Django",
            "category": "technical",
            "confirmed": True,
            "source": {"type": "manual", "index": None, "label": ""},
        },
        {
            "id": "e4",
            "term": "PostgreSQL",
            "category": "technical",
            "confirmed": True,
            "source": {"type": "manual", "index": None, "label": ""},
        },
        {
            "id": "e5",
            "term": "SQL",
            "category": "technical",
            "confirmed": True,
            "source": {"type": "manual", "index": None, "label": ""},
        },
    ]
    resume = SimpleNamespace(headline="", job_profiles=[ekonomi, it_support])
    posting = SimpleNamespace(
        title="Backend",
        description=(
            "Krav\n- Python\n- Django\n- PostgreSQL\n- SQL\n- Excel\n"
            + ("Lång beskrivning. " * 40)
        ),
    )
    scored = score_all_profiles(resume, posting)
    assert len(scored) == 2
    assert scored[0]["label"] == "IT-support"
    assert (scored[0]["score"] or -1) >= (scored[1]["score"] or -1)
