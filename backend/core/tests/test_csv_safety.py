from core.csv_safety import sanitize_csv_cell


def test_sanitize_csv_cell_prefixes_formula_chars():
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("+123") == "'+123"
    assert sanitize_csv_cell("-cmd") == "'-cmd"
    assert sanitize_csv_cell("@sum") == "'@sum"


def test_sanitize_csv_cell_leaves_safe_text():
    assert sanitize_csv_cell("Acme AB") == "Acme AB"
    assert sanitize_csv_cell("") == ""
    assert sanitize_csv_cell(None) == ""
