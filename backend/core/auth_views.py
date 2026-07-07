from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.registration.views import (
    RegisterView,
    ResendEmailVerificationView,
    SocialLoginView,
    VerifyEmailView,
)
from rest_framework import status
from rest_framework.response import Response

from .spa_urls import spa_app_url


class ThrottledVerifyEmailView(VerifyEmailView):
    throttle_scope = "dj_rest_auth"


class ThrottledResendEmailVerificationView(ResendEmailVerificationView):
    throttle_scope = "dj_rest_auth"


class ThrottledTokenRefreshView(get_refresh_view()):
    throttle_scope = "dj_rest_auth"


class GoogleLoginView(SocialLoginView):
    """Exchange a Google authorization code for our JWT pair.

    The SPA redirects the user to Google's consent screen and posts the
    returned ``code`` here. Requires GOOGLE_CLIENT_ID/SECRET in the
    environment (the button is hidden in the SPA when unset).
    """

    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    throttle_scope = "dj_rest_auth"

    @property
    def callback_url(self):
        # Must match the redirect_uri the SPA used (/app/ on same origin).
        return spa_app_url(request=self.request)


class SPARegisterView(RegisterView):
    """Register without issuing JWT — user must verify e-mail first."""

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(request)
        return Response(
            {
                "detail": (
                    "Konto skapat. Vi har skickat ett verifieringsmejl — "
                    "klicka på länken innan du loggar in."
                )
            },
            status=status.HTTP_201_CREATED,
        )
