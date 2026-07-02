from core.auth_views import (
    GoogleLoginView,
    SPARegisterView,
    ThrottledResendEmailVerificationView,
    ThrottledVerifyEmailView,
)
from core.views import health, runtime_config, security_txt
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from config.api_docs import DebugOrAdminPermission

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("runtime-config.js", runtime_config, name="runtime-config"),
    path(".well-known/security.txt", security_txt, name="security-txt"),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[DebugOrAdminPermission]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
            permission_classes=[DebugOrAdminPermission],
        ),
        name="swagger-ui",
    ),
    path("dj-rest-auth/", include("core.auth_urls")),
    path("dj-rest-auth/google/", GoogleLoginView.as_view(), name="google_login"),
    path(
        "dj-rest-auth/registration/verify-email/",
        ThrottledVerifyEmailView.as_view(),
        name="rest_verify_email",
    ),
    path(
        "dj-rest-auth/registration/resend-email/",
        ThrottledResendEmailVerificationView.as_view(),
        name="rest_resend_email",
    ),
    path(
        "dj-rest-auth/registration/account-confirm-email/",
        ThrottledVerifyEmailView.as_view(),
        name="account_email_verification_sent",
    ),
    path(
        "dj-rest-auth/registration/",
        SPARegisterView.as_view(),
        name="rest_register",
    ),
    path("api/v1/", include("core.urls")),
]
