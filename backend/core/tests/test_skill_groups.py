from core.skill_groups import (
    EMPTY_SKILL_GROUPS,
    flatten_skill_groups,
    normalize_skill_groups,
    skill_groups_from_flat,
)


def test_normalize_skill_groups_dedupes_within_category():
    groups = normalize_skill_groups(
        {"technical": ["Python", "python", " Django "], "domain": [], "languages": []}
    )
    assert groups["technical"] == ["Python", "Django"]


def test_flatten_skill_groups_preserves_order_and_dedupes():
    groups = {
        "technical": ["Python", "Excel"],
        "domain": ["Agile", "python"],
        "languages": ["Svenska"],
    }
    assert flatten_skill_groups(groups) == ["Python", "Excel", "Agile", "Svenska"]


def test_skill_groups_from_flat_puts_all_in_technical():
    assert skill_groups_from_flat(["Rust", "Go"]) == {
        **EMPTY_SKILL_GROUPS,
        "technical": ["Rust", "Go"],
    }
