from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    # health (public)
    path("health/", health),
    # Versioned API root
    path("api/v1/", include("core.urls")),
    # OpenAPI + Swagger UI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
