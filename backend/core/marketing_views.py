"""Crawlable marketing pages and SPA shell under /app/."""

from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.views.decorators.http import require_GET

AUTH_SPA_QUERY_KEYS = frozenset(
    {"verify_key", "reset_uid", "reset_token", "code", "state"}
)

_MARKETING_STATIC = Path(__file__).resolve().parent / "static" / "marketing"

FAQ_ITEMS = [
    {
        "question": "Kostar Jobbdjungeln något?",
        "answer": (
            "Nej. Tjänsten är gratis, utan annonser och utan att sälja din data "
            "till arbetsgivare."
        ),
    },
    {
        "question": "Är Jobbdjungeln en rekryteringssajt?",
        "answer": (
            "Nej. Du håller koll på dina egna ansökningar. Vi publicerar inte din "
            "profil och matchar dig inte mot arbetsgivare."
        ),
    },
    {
        "question": "Var lagras min data?",
        "answer": (
            "I EU. Appen körs i Frankfurt. Du kan exportera allt som CSV eller "
            "radera kontot när du vill."
        ),
    },
    {
        "question": "Sparar ni filen när jag laddar upp CV?",
        "answer": (
            "Nej. Filen tolkas i minnet och sparas inte. Det som blir kvar är den "
            "strukturerade text du själv kan redigera i appen."
        ),
    },
    {
        "question": "Hur tar jag bort mitt konto?",
        "answer": (
            "När du är inloggad: öppna Profil och CV och radera kontot där. "
            "All data försvinner direkt."
        ),
    },
]


def _origin(request) -> str:
    return request.build_absolute_uri("/").rstrip("/")


def _page_urls() -> dict:
    return {
        "app_url": "/app/",
        "home_url": "/",
        "privacy_url": "/integritet/",
        "about_url": "/om/",
        "faq_url": "/faq/",
    }


def _marketing_context(request, path, *, current_page, breadcrumbs=None, extra=None):
    origin = _origin(request)
    ctx = {
        **_page_urls(),
        "canonical_url": request.build_absolute_uri(path),
        "contact_email": settings.CONTACT_EMAIL,
        "og_image_url": f"{origin}/og-image.jpg",
        "schema_url": (
            f"{origin}/schema/{current_page}.json"
            if current_page in {"home", "about", "faq", "privacy"}
            else ""
        ),
        "current_page": current_page,
        "breadcrumbs": breadcrumbs or [],
        "faq_items": FAQ_ITEMS,
    }
    if extra:
        ctx.update(extra)
    return ctx


def _org_schema(origin: str) -> dict:
    org = {
        "@type": "Organization",
        "@id": f"{origin}/#org",
        "name": "Jobbdjungeln",
        "url": f"{origin}/",
        "logo": f"{origin}/apple-touch-icon.png",
        "image": f"{origin}/og-image.jpg",
        "areaServed": {"@type": "Country", "name": "Sweden"},
    }
    if settings.CONTACT_EMAIL:
        org["email"] = settings.CONTACT_EMAIL
    return org


def _local_business_schema(origin: str) -> dict:
    return {
        "@type": "ProfessionalService",
        "@id": f"{origin}/#local",
        "name": "Jobbdjungeln",
        "url": f"{origin}/",
        "image": f"{origin}/og-image.jpg",
        "priceRange": "Free",
        "availableLanguage": ["sv"],
        "areaServed": {"@type": "Country", "name": "Sweden"},
        "address": {"@type": "PostalAddress", "addressCountry": "SE"},
        "parentOrganization": {"@id": f"{origin}/#org"},
    }


def _breadcrumb_schema(origin: str, crumbs: list[dict]) -> dict:
    return {
        "@type": "BreadcrumbList",
        "@id": f"{origin}/#breadcrumb",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "name": crumb["name"],
                "item": origin + crumb["url"] if crumb["url"] else None,
            }
            for index, crumb in enumerate(crumbs, start=1)
        ],
    }


def _schema_graph(request, page: str) -> dict:
    origin = _origin(request)
    org = _org_schema(origin)
    local = _local_business_schema(origin)
    website = {
        "@type": "WebSite",
        "@id": f"{origin}/#website",
        "name": "Jobbdjungeln",
        "url": f"{origin}/",
        "inLanguage": "sv-SE",
        "publisher": {"@id": f"{origin}/#org"},
    }
    graph: list[dict] = [org, local, website]

    if page == "home":
        graph.append(
            {
                "@type": "WebApplication",
                "@id": f"{origin}/#app",
                "name": "Jobbdjungeln",
                "url": f"{origin}/",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "inLanguage": "sv",
                "description": (
                    "Gratis översikt över jobbansökningar med Platsbanken-sök "
                    "och påminnelser."
                ),
                "image": f"{origin}/og-image.jpg",
                "publisher": {"@id": f"{origin}/#org"},
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "SEK"},
            }
        )
        graph.append(
            {
                "@type": "WebPage",
                "@id": f"{origin}/#webpage",
                "name": "Jobbdjungeln — koll på hela ditt jobbsök",
                "url": f"{origin}/",
                "isPartOf": {"@id": f"{origin}/#website"},
                "about": {"@id": f"{origin}/#app"},
            }
        )
    elif page == "about":
        graph.append(
            _breadcrumb_schema(
                origin,
                [
                    {"name": "Start", "url": "/"},
                    {"name": "Om Jobbdjungeln", "url": "/om/"},
                ],
            )
        )
        graph.append(
            {
                "@type": "AboutPage",
                "@id": f"{origin}/om/#webpage",
                "name": "Om Jobbdjungeln",
                "url": f"{origin}/om/",
                "isPartOf": {"@id": f"{origin}/#website"},
            }
        )
    elif page == "faq":
        graph.append(
            _breadcrumb_schema(
                origin,
                [
                    {"name": "Start", "url": "/"},
                    {"name": "Vanliga frågor", "url": "/faq/"},
                ],
            )
        )
        graph.append(
            {
                "@type": "FAQPage",
                "@id": f"{origin}/faq/#webpage",
                "name": "Vanliga frågor — Jobbdjungeln",
                "url": f"{origin}/faq/",
                "isPartOf": {"@id": f"{origin}/#website"},
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": item["question"],
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": item["answer"],
                        },
                    }
                    for item in FAQ_ITEMS
                ],
            }
        )
    elif page == "privacy":
        graph.append(
            _breadcrumb_schema(
                origin,
                [
                    {"name": "Start", "url": "/"},
                    {"name": "Integritetspolicy", "url": "/integritet/"},
                ],
            )
        )
        graph.append(
            {
                "@type": "WebPage",
                "@id": f"{origin}/integritet/#webpage",
                "name": "Integritetspolicy — Jobbdjungeln",
                "url": f"{origin}/integritet/",
                "isPartOf": {"@id": f"{origin}/#website"},
            }
        )

    # BreadcrumbList.item must not be null; drop empty item keys.
    for node in graph:
        if node.get("@type") == "BreadcrumbList":
            for entry in node.get("itemListElement", []):
                if entry.get("item") is None:
                    entry.pop("item", None)

    return {"@context": "https://schema.org", "@graph": graph}


@require_GET
def landing(request):
    if AUTH_SPA_QUERY_KEYS.intersection(request.GET):
        qs = request.META.get("QUERY_STRING", "")
        suffix = f"?{qs}" if qs else ""
        return HttpResponseRedirect(f"/app/{suffix}")

    return render(
        request,
        "marketing/landing.html",
        _marketing_context(request, "/", current_page="home"),
    )


@require_GET
def privacy_page(request):
    return render(
        request,
        "marketing/privacy.html",
        _marketing_context(
            request,
            "/integritet/",
            current_page="privacy",
            breadcrumbs=[
                {"name": "Start", "url": "/"},
                {"name": "Integritetspolicy", "url": ""},
            ],
        ),
    )


@require_GET
def about_page(request):
    return render(
        request,
        "marketing/about.html",
        _marketing_context(
            request,
            "/om/",
            current_page="about",
            breadcrumbs=[
                {"name": "Start", "url": "/"},
                {"name": "Om Jobbdjungeln", "url": ""},
            ],
        ),
    )


@require_GET
def faq_page(request):
    return render(
        request,
        "marketing/faq.html",
        _marketing_context(
            request,
            "/faq/",
            current_page="faq",
            breadcrumbs=[
                {"name": "Start", "url": "/"},
                {"name": "Vanliga frågor", "url": ""},
            ],
        ),
    )


def page_not_found(request, exception):
    return render(
        request,
        "marketing/404.html",
        _marketing_context(
            request,
            request.path,
            current_page="404",
            breadcrumbs=[
                {"name": "Start", "url": "/"},
                {"name": "Sidan finns inte", "url": ""},
            ],
        ),
        status=404,
    )


@require_GET
def robots_txt(request):
    sitemap = request.build_absolute_uri("/sitemap.xml")
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Allow: /integritet/",
            "Allow: /om/",
            "Allow: /faq/",
            "Disallow: /app/",
            "Disallow: /api/",
            "Disallow: /admin/",
            f"Sitemap: {sitemap}",
            "",
        ]
    )
    return HttpResponse(body, content_type="text/plain; charset=utf-8")


@require_GET
def sitemap_xml(request):
    base = request.build_absolute_uri("/").rstrip("/")
    entries = [
        ("", "daily", "1.0"),
        ("/om/", "monthly", "0.7"),
        ("/faq/", "monthly", "0.7"),
        ("/integritet/", "monthly", "0.6"),
    ]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path, changefreq, priority in entries:
        loc = f"{base}{path}" if path else f"{base}/"
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                f"    <changefreq>{changefreq}</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )
    lines.append("</urlset>")
    return HttpResponse("\n".join(lines), content_type="application/xml")


@require_GET
def llms_txt(request):
    origin = _origin(request)
    contact = settings.CONTACT_EMAIL or "(kontaktadress saknas)"
    body = "\n".join(
        [
            "# Jobbdjungeln",
            "",
            "> Personlig översikt över jobbansökningar för jobbsökare i Sverige.",
            "",
            "Jobbdjungeln är inte en rekryteringssajt och inte en del av "
            "Arbetsförmedlingen. Användare spårar egna ansökningar, söker live "
            "i Platsbanken och jämför annonskrav mot sitt CV. Tjänsten är gratis. "
            "Data lagras i EU. Användaren kan exportera eller radera allt.",
            "",
            "## Sidor",
            "",
            f"- [{origin}/]({origin}/): startsida",
            f"- [{origin}/om/]({origin}/om/): om tjänsten",
            f"- [{origin}/faq/]({origin}/faq/): vanliga frågor",
            f"- [{origin}/integritet/]({origin}/integritet/): integritetspolicy",
            f"- [{origin}/app/]({origin}/app/): inloggad app (inte för indexering)",
            "",
            "## Kontakt",
            "",
            contact,
            "",
        ]
    )
    return HttpResponse(body, content_type="text/plain; charset=utf-8")


@require_GET
def json_ld(request, page):
    allowed = {"home", "about", "faq", "privacy"}
    if page not in allowed:
        raise Http404
    payload = _schema_graph(request, page)
    return HttpResponse(
        json.dumps(payload, ensure_ascii=False, indent=2),
        content_type="application/ld+json; charset=utf-8",
    )


_BRAND_FILES = {
    "favicon.ico": ("favicon.ico", "image/x-icon"),
    "favicon.svg": ("favicon.svg", "image/svg+xml"),
    "favicon-32.png": ("favicon-32.png", "image/png"),
    "apple-touch-icon.png": ("apple-touch-icon.png", "image/png"),
    "og-image.jpg": ("og-image.jpg", "image/jpeg"),
}


@require_GET
def branded_asset(request, filename):
    spec = _BRAND_FILES.get(filename)
    if not spec:
        raise Http404
    name, content_type = spec
    path = _MARKETING_STATIC / name
    if not path.is_file():
        raise Http404
    response = FileResponse(path.open("rb"), content_type=content_type)
    response["Cache-Control"] = "public, max-age=86400"
    return response


@require_GET
def spa_app(request, subpath=""):
    index = settings.FRONTEND_DIST / "app" / "index.html"
    if not index.is_file():
        return HttpResponse(
            "Appen är inte byggd ännu. Kör npm run build i frontend/.",
            status=503,
            content_type="text/plain; charset=utf-8",
        )
    return FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
