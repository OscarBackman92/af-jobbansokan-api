from core.ad_url import ad_urls_equivalent, normalize_ad_url


def test_normalize_strips_tracking_and_trailing_slash():
    assert (
        normalize_ad_url("http://Example.com/jobb/1/?utm_source=mail")
        == "https://example.com/jobb/1"
    )


def test_ad_urls_equivalent_for_http_https_variants():
    assert ad_urls_equivalent(
        "https://example.com/jobb/1",
        "http://example.com/jobb/1/",
    )
