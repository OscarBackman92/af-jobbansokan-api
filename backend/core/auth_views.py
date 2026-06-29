from rest_framework import status
from rest_framework.response import Response

from dj_rest_auth.registration.views import RegisterView


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
