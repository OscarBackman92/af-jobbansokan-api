from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

TRACKING_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
    }
)


def normalize_ad_url(value: str) -> str:
    """Canonical form for comparing and storing job ad URLs."""
    value = (value or "").strip()
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https"):
        return value

    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") if len(parsed.path) > 1 else parsed.path
    query_pairs = [
        (key, val)
        for key, val in parse_qsl(parsed.query, keep_blank_values=True)
        if not (key.startswith("utm_") or key in TRACKING_PARAMS)
    ]
    query = urlencode(query_pairs)
    return urlunparse(("https", netloc, path, "", query, ""))


def ad_urls_equivalent(a: str, b: str) -> bool:
    left = normalize_ad_url(a)
    right = normalize_ad_url(b)
    return bool(left) and left == right
