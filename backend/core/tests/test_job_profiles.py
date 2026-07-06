import pytest
from core.job_profiles import (
    active_profile,
    add_evidence_to_profile,
    evidence_to_skill_groups,
    normalize_job_profiles,
    profile_skill_terms,
    profiles_from_skill_groups,
)
from core.matching import match_evidence
from types import SimpleNamespace

pytestmark = pytest.mark.django_db


def test_normalize_creates_default_profile():
    profiles = normalize_job_profiles([])
    assert len(profiles) == 1
    assert profiles[0]["active"] is True
    assert profiles[0]["label"] == "Mitt jobbsök"


def test_migrate_skill_groups_to_profile():
    groups = {
        "technical": ["Python", "Excel"],
        "domain": ["Inköp"],
        "languages": ["Svenska"],
    }
    profiles = profiles_from_skill_groups(groups, headline="Inköpare")
    assert len(profiles) == 1
    assert profiles[0]["label"] == "Inköpare"
    assert len(profiles[0]["evidence"]) == 4


def test_add_evidence_dedupes_terms():
    profile = normalize_job_profiles([])[0]
    source = {"type": "experience", "index": 0, "label": "Erfarenhet 1: Inköpare"}
    profile = add_evidence_to_profile(
        profile, term="Wint", category="technical", source=source
    )
    profile = add_evidence_to_profile(
        profile, term="wint", category="technical", source=source
    )
    assert len(profile["evidence"]) == 1


def test_match_evidence_includes_source():
    evidence = [
        {
            "term": "Python",
            "category": "technical",
            "confirmed": True,
            "source": {"type": "experience", "index": 0, "label": "Erfarenhet 1"},
        }
    ]
    result = match_evidence(
        evidence,
        SimpleNamespace(title="Utvecklare", description="Vi söker Python-utvecklare."),
    )
    assert result["count"] == 1
    assert result["matched_detail"][0]["source"]["label"] == "Erfarenhet 1"


def test_profile_skill_terms_from_evidence():
    profiles = profiles_from_skill_groups(
        {"technical": ["Excel"], "domain": [], "languages": []}
    )
    assert profile_skill_terms(active_profile(profiles)) == ["Excel"]
    groups = evidence_to_skill_groups(profiles[0]["evidence"])
    assert groups["technical"] == ["Excel"]
