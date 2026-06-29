"""CSV export helpers — mitigate spreadsheet formula injection."""


def sanitize_csv_cell(value) -> str:
    """Prefix dangerous leading characters so Excel/Sheets won't execute formulas."""
    if value is None:
        return ""
    text = str(value)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text}"
    return text
