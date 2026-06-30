from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.registration.views import (
    RegisterView,
    ResendEmailVerificationView,
    VerifyEmailView,
)
from rest_framework import status
from rest_framework.response import Response


class ThrottledVerifyEmailView(VerifyEmailView):
    throttle_scope = "dj_rest_auth"


class ThrottledResendEmailVerificationView(ResendEmailVerificationView):
    throttle_scope = "dj_rest_auth"


class ThrottledTokenRefreshView(get_refresh_view()):
    throttle_scope = "dj_rest_auth"


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
