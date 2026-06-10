from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .audit import log_event
from .models import AuditLog, JobApplication, JobPosting
from .permissions import IsEmployer, IsEmployerAdminOrReadOnly
from .serializers import (
    EmployerJobApplicationSerializer,
    JobApplicationSerializer,
    JobPostingSerializer,
)


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


def _date_param(params, name):
    raw = params.get(name)
    if not raw:
        return None
    value = parse_date(raw)
    if value is None:
        raise ValidationError({name: "Invalid date, expected YYYY-MM-DD."})
    return value


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "from", OpenApiTypes.DATE, description="Earliest applied_at date."
            ),
            OpenApiParameter(
                "to", OpenApiTypes.DATE, description="Latest applied_at date."
            ),
            OpenApiParameter(
                "status", OpenApiTypes.STR, description="Filter by status."
            ),
        ]
    )
)
class JobApplicationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Applicant-facing job application events.

    Events are evidence of job seeking and therefore immutable: they can be
    created, listed and deleted, but never edited. Creation and deletion are
    audit logged.
    """

    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobApplication.objects.none()
        qs = JobApplication.objects.filter(owner=self.request.user).order_by(
            "-created_at"
        )
        params = self.request.query_params
        date_from = _date_param(params, "from")
        date_to = _date_param(params, "to")
        if date_from:
            qs = qs.filter(applied_at__gte=date_from)
        if date_to:
            qs = qs.filter(applied_at__lte=date_to)
        status = params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs

    def perform_create(self, serializer):
        application = serializer.save(owner=self.request.user)
        log_event(
            self.request.user,
            AuditLog.ACTION_APPLICATION_CREATED,
            target=application,
            posting_id=application.posting_id,
        )

    def perform_destroy(self, instance):
        log_event(
            self.request.user,
            AuditLog.ACTION_APPLICATION_DELETED,
            target=instance,
            posting_id=instance.posting_id,
        )
        instance.delete()


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


class EmployerApplicationsView(generics.ListAPIView):
    """List applications to the employer's own organization.

    Every call is audit logged as a disclosure of applicant data.
    """

    serializer_class = EmployerJobApplicationSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobApplication.objects.none()
        org = self.request.user.employer_profile.organization
        return (
            JobApplication.objects.select_related(
                "posting", "posting__organization", "owner"
            )
            .filter(posting__organization=org)
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        disclosed = response.data["results"]
        log_event(
            request.user,
            AuditLog.ACTION_APPLICATIONS_DISCLOSED,
            organization_id=request.user.employer_profile.organization_id,
            application_count=len(disclosed),
        )
        return response
