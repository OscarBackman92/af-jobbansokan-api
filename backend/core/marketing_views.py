"""Crawlable marketing pages and SPA shell under /app/."""

from __future__ import annotations

from django.conf import settings
from django.http import FileResponse, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.views.decorators.http import require_GET

AUTH_SPA_QUERY_KEYS = frozenset(
    {"verify_key", "reset_uid", "reset_token", "code", "state"}
)


@require_GET
def landing(request):
    if AUTH_SPA_QUERY_KEYS.intersection(request.GET):
        qs = request.META.get("QUERY_STRING", "")
        suffix = f"?{qs}" if qs else ""
        return HttpResponseRedirect(f"/app/{suffix}")

    return render(
        request,
        "marketing/landing.html",
        {
            "app_url": "/app/",
            "home_url": "/",
            "privacy_url": "/integritet/",
            "canonical_url": request.build_absolute_uri("/"),
            "contact_email": settings.CONTACT_EMAIL,
        },
    )


@require_GET
def privacy_page(request):
    return render(
        request,
        "marketing/privacy.html",
        {
            "app_url": "/app/",
            "home_url": "/",
            "canonical_url": request.build_absolute_uri("/integritet/"),
            "contact_email": settings.CONTACT_EMAIL,
        },
    )


@require_GET
def robots_txt(request):
    sitemap = request.build_absolute_uri("/sitemap.xml")
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Allow: /integritet/",
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
def spa_app(request, subpath=""):
    index = settings.FRONTEND_DIST / "app" / "index.html"
    if not index.is_file():
        return HttpResponse(
            "Appen är inte byggd ännu. Kör npm run build i frontend/.",
            status=503,
            content_type="text/plain; charset=utf-8",
        )
    return FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
