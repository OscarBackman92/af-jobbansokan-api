from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import JobApplication, JobPosting
from .permissions import IsEmployerAdminOrReadOnly, IsEmployer
from .serializers import JobApplicationSerializer, JobPostingSerializer, EmployerJobApplicationSerializer


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
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return JobApplication.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class JobPostingViewSet(viewsets.ModelViewSet):
    serializer_class = JobPostingSerializer
    permission_classes = [IsEmployerAdminOrReadOnly]

    def get_queryset(self):
        # Public read of all postings (for MVP).
        # Later we can filter by org, published flag, etc.
        return JobPosting.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        # Writer must be employer admin -> safe to assume profile exists.
        org = self.request.user.employer_profile.organization
        serializer.save(organization=org)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsEmployer])
def employer_applications(request):
    org = request.user.employer_profile.organization
    qs = (
        JobApplication.objects.select_related("posting", "posting__organization", "owner")
        .filter(posting__organization=org)
        .order_by("-created_at")
    )

    serializer = EmployerJobApplicationSerializer(qs, many=True)
    return Response(serializer.data)