from dj_rest_auth.views import (
    LoginView,
    LogoutView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetView,
    UserDetailsView,
)
from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView

from core.auth_views import ThrottledTokenRefreshView

urlpatterns = [
    path("password/reset/", PasswordResetView.as_view(), name="rest_password_reset"),
    path(
        "password/reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="rest_password_reset_confirm",
    ),
    path("login/", LoginView.as_view(), name="rest_login"),
    path("logout/", LogoutView.as_view(), name="rest_logout"),
    path("user/", UserDetailsView.as_view(), name="rest_user_details"),
    path(
        "password/change/",
        PasswordChangeView.as_view(),
        name="rest_password_change",
    ),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path(
        "token/refresh/",
        ThrottledTokenRefreshView.as_view(),
        name="token_refresh",
    ),
]
