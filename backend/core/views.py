"""Core API views."""

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import JobApplication
from .serializers import JobApplicationSerializer


@extend_schema(
    responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}}
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    """Public health check endpoint."""
    return Response({"status": "ok"})


@extend_schema(
    responses={
        200: {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "username": {"type": "string"},
                "email": {"type": "string"},
            },
        }
    }
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return basic info about the currently authenticated user."""
    user = request.user
    return Response({"id": user.id, "username": user.username, "email": user.email})


class JobApplicationViewSet(viewsets.ModelViewSet):
    """CRUD for job applications, scoped to the current user."""

    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only the current user's job applications."""
        return JobApplication.objects.filter(owner=self.request.user).order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        """Ensure owner is always the current user."""
        serializer.save(owner=self.request.user)
