from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import audit
from .models import JobApplication, JobPosting
from .permissions import IsEmployerAdminOrReadOnly, IsEmployer
from .serializers import (
    JobApplicationSerializer,
    JobPostingSerializer,
    EmployerJobApplicationSerializer,
    EmployerApplicationStatusSerializer,
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
                "is_employer": {"type": "boolean"},
                "employer_role": {"type": "string", "nullable": True},
            },
        }
    }
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return info about the currently authenticated user, including employer status."""
    user = request.user
    profile = getattr(user, "employer_profile", None)
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_employer": profile is not None,
            "employer_role": profile.role if profile else None,
        }
    )


class JobApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["posting__title", "posting__company_name", "status"]
    ordering_fields = ["applied_at", "created_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            JobApplication.objects.select_related("posting", "posting__organization")
            .filter(owner=self.request.user)
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        instance = serializer.save(owner=self.request.user, status="applied")
        audit.log(
            self.request,
            action="application.create",
            resource="JobApplication",
            resource_id=instance.pk,
            detail={"posting_id": instance.posting_id},
        )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        instance = serializer.save()
        audit.log(
            self.request,
            action="application.update",
            resource="JobApplication",
            resource_id=instance.pk,
            detail={"old_status": old_status, "new_status": instance.status},
        )

    def perform_destroy(self, instance):
        audit.log(
            self.request,
            action="application.delete",
            resource="JobApplication",
            resource_id=instance.pk,
            detail={"posting_id": instance.posting_id},
        )
        instance.delete()


class JobPostingViewSet(viewsets.ModelViewSet):
    serializer_class = JobPostingSerializer
    permission_classes = [IsEmployerAdminOrReadOnly]
    search_fields = ["title", "company_name", "location", "organization__name"]
    ordering_fields = ["published_at", "created_at", "title", "company_name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return JobPosting.objects.select_related("organization").order_by("-created_at")

    def perform_create(self, serializer):
        org = self.request.user.employer_profile.organization
        instance = serializer.save(organization=org)
        audit.log(
            self.request,
            action="posting.create",
            resource="JobPosting",
            resource_id=instance.pk,
            detail={"title": instance.title},
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        audit.log(
            self.request,
            action="posting.update",
            resource="JobPosting",
            resource_id=instance.pk,
        )

    def perform_destroy(self, instance):
        audit.log(
            self.request,
            action="posting.delete",
            resource="JobPosting",
            resource_id=instance.pk,
            detail={"title": instance.title},
        )
        instance.delete()


@extend_schema(
    parameters=[
        OpenApiParameter("status", str, description="Filter by application status"),
    ]
)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsEmployer])
def employer_applications(request):
    """List all applications to the employer's organisation's postings."""
    org = request.user.employer_profile.organization
    qs = (
        JobApplication.objects.select_related("posting", "posting__organization", "owner")
        .filter(posting__organization=org)
        .order_by("-created_at")
    )

    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)

    audit.log(
        request,
        action="employer.view",
        resource="JobApplication",
        detail={"org_id": org.pk, "status_filter": status_filter or "all"},
    )

    serializer = EmployerJobApplicationSerializer(qs, many=True)
    return Response(serializer.data)


@extend_schema(
    request=EmployerApplicationStatusSerializer,
    responses={200: EmployerJobApplicationSerializer},
)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsEmployer])
def employer_application_update(request, pk: int):
    """Employer updates the status of a single application in their organisation."""
    org = request.user.employer_profile.organization
    application = get_object_or_404(
        JobApplication.objects.select_related("posting", "posting__organization", "owner"),
        pk=pk,
        posting__organization=org,
    )

    old_status = application.status
    serializer = EmployerApplicationStatusSerializer(application, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    audit.log(
        request,
        action="application.update",
        resource="JobApplication",
        resource_id=application.pk,
        detail={
            "actor": "employer",
            "old_status": old_status,
            "new_status": application.status,
            "org_id": org.pk,
        },
    )

    return Response(EmployerJobApplicationSerializer(application).data)
