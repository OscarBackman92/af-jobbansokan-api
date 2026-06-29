from core.auth_views import SPARegisterView
from core.views import health, runtime_config
from django.contrib import admin
from django.urls import include, path
from dj_rest_auth.registration.views import ResendEmailVerificationView, VerifyEmailView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from rest_framework.permissions import AllowAny

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("runtime-config.js", runtime_config, name="runtime-config"),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[AllowAny]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
            permission_classes=[AllowAny],
        ),
        name="swagger-ui",
    ),
    path("dj-rest-auth/", include("dj_rest_auth.urls")),
    path(
        "dj-rest-auth/registration/verify-email/",
        VerifyEmailView.as_view(),
        name="rest_verify_email",
    ),
    path(
        "dj-rest-auth/registration/resend-email/",
        ResendEmailVerificationView.as_view(),
        name="rest_resend_email",
    ),
    path(
        "dj-rest-auth/registration/account-confirm-email/",
        VerifyEmailView.as_view(),
        name="account_email_verification_sent",
    ),
    path(
        "dj-rest-auth/registration/",
        SPARegisterView.as_view(),
        name="rest_register",
    ),
    path("api/v1/", include("core.urls")),
]
