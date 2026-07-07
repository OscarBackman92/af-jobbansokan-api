from core.skill_canonical import canonical_skill_label, skill_match_terms


def test_canonical_skill_label_merges_synonyms():
    assert canonical_skill_label("Microsoft Excel") == "Excel"
    assert canonical_skill_label("m365") == "Microsoft 365"
    assert canonical_skill_label("Projektledare") == "Projektledning"


def test_skill_match_terms_includes_aliases():
    terms = {term.lower() for term in skill_match_terms("Excel")}
    assert "excel" in terms
    assert "microsoft excel" in terms
