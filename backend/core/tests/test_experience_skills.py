import pytest
from core.experience_skills import (
    has_skill_suggestions,
    suggest_skills_from_experience,
)

FINANCE_EXPERIENCE = [
    {
        "title": "Ekonomiansvarig",
        "company": "House of Service",
        "description": """
Central roll med ansvar för ekonomi, administration och uppföljning för
House of Service IT och FM, med fokus på effektiva och skalbara processer.
Operativt ansvar för kund- och leverantörsfakturor – kontering, matchning
och attest – samt fakturering av avtal och avstämning vid licensförändringar.
Huvudkontakt mot extern ekonomipartner (Wint) gällande bokföring, löner
och redovisning. Ansvarar för integrationer mellan affärssystem och webshop.
Agerar koordinator och projektledare gentemot försäljning, operations,
support och externa parter. Utvecklar interna kontroller, processer och
attestflöden, säkerställer regelefterlevnad (skatt, moms, redovisning).
""",
    }
]


def test_suggest_finance_experience_includes_wint_and_domain_terms():
    suggestions = suggest_skills_from_experience(FINANCE_EXPERIENCE)
    labels = {
        item["label"].lower()
        for items in suggestions.values()
        for item in items
    }
    assert "wint" in labels
    assert "kontering" in labels
    assert "bokföring" in labels
    assert "projektledare" in labels
    assert "regelefterlevnad" in labels
    assert suggestions["technical"][0]["label"] == "Wint"
    assert suggestions["technical"][0]["source"].startswith("Erfarenhet 1:")


def test_suggest_skips_already_saved_skills():
    suggestions = suggest_skills_from_experience(
        FINANCE_EXPERIENCE,
        existing_groups={
            "technical": ["Wint"],
            "domain": ["kontering"],
            "languages": [],
        },
    )
    labels = [item["label"] for item in suggestions["technical"]]
    assert "Wint" not in labels
    assert all(item["label"] != "kontering" for item in suggestions["domain"])


def test_suggest_includes_source_per_row():
    suggestions = suggest_skills_from_experience(
        [
            {"title": "Utvecklare", "description": "Arbetade med Python och Django."},
            {"title": "Support", "description": "Kundservice och Excel-rapporter."},
        ]
    )
    python = next(
        item for item in suggestions["technical"] if item["label"] == "Python"
    )
    excel = next(item for item in suggestions["technical"] if item["label"] == "Excel")
    assert "Erfarenhet 1" in python["source"]
    assert "Erfarenhet 2" in excel["source"]


def test_has_skill_suggestions():
    assert not has_skill_suggestions({"technical": [], "domain": [], "languages": []})
    assert has_skill_suggestions(
        suggest_skills_from_experience(FINANCE_EXPERIENCE)
    )
