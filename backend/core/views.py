from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .audit import log_event
from .identity import normalize_personal_number, pseudonymize_personal_number
from .models import (
    ApplicantProfile,
    AuditLog,
    EmployerProfile,
    JobApplication,
    JobPosting,
)
from .partner_auth import IsPartner, PartnerAPIKeyAuthentication
from .permissions import IsEmployer, IsEmployerAdminOrReadOnly
from .serializers import (
    EmployerApplicationStatusSerializer,
    EmployerJobApplicationSerializer,
    JobApplicationSerializer,
    JobPostingDetailSerializer,
    JobPostingSerializer,
    OrganizationSerializer,
    PartnerApplicationEventSerializer,
    ProfileSerializer,
)
from .throttling import PartnerRateThrottle


@extend_schema(
    responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}}
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    """Public health check endpoint."""
    return Response({"status": "ok"})


class ProfileView(generics.RetrieveUpdateDestroyAPIView):
    """The authenticated user's own profile.

    GET returns contact details plus identity/employer status. PATCH
    updates contact details. DELETE erases the account and everything it
    owns (GDPR right to erasure) — audit entries survive with the actor
    anonymized, which is exactly their documented retention behavior.
    """

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_destroy(self, instance):
        log_event(
            instance,
            AuditLog.ACTION_ACCOUNT_DELETED,
            user_id=instance.id,
            username=instance.get_username(),
        )
        instance.delete()


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

    def get_serializer_class(self):
        # Lean list payloads; full posting (description, link) elsewhere.
        if self.action == "list":
            return JobPostingSerializer
        return JobPostingDetailSerializer

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


class EmployerApplicationStatusView(generics.UpdateAPIView):
    """Employer-side status update (applied/interview/offer/rejected).

    Any employer in the posting's organization may update; every change
    is audit logged with the old and new value. An employer-set status
    also acts as third-party corroboration of the application event.
    """

    serializer_class = EmployerApplicationStatusSerializer
    permission_classes = [IsAuthenticated, IsEmployer]
    http_method_names = ["patch", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobApplication.objects.none()
        org = self.request.user.employer_profile.organization
        return JobApplication.objects.filter(posting__organization=org)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        application = serializer.save()
        if previous != application.status:
            log_event(
                self.request.user,
                AuditLog.ACTION_STATUS_CHANGED,
                target=application,
                from_status=previous,
                to_status=application.status,
            )


class OrganizationCreateView(generics.CreateAPIView):
    """Employer onboarding: create an organization and become its admin."""

    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        if hasattr(self.request.user, "employer_profile"):
            raise ValidationError({"detail": "You already belong to an organization."})
        organization = serializer.save()
        EmployerProfile.objects.create(
            user=self.request.user, organization=organization, role="admin"
        )


@extend_schema(
    parameters=[
        OpenApiParameter(
            "person",
            OpenApiTypes.STR,
            required=True,
            description="Personal identity number (YYYYMMDDNNNN).",
        ),
        OpenApiParameter(
            "from", OpenApiTypes.DATE, description="Earliest applied_at date."
        ),
        OpenApiParameter(
            "to", OpenApiTypes.DATE, description="Latest applied_at date."
        ),
    ],
    responses=PartnerApplicationEventSerializer(many=True),
)
@api_view(["GET"])
@authentication_classes([PartnerAPIKeyAuthentication])
@permission_classes([IsPartner])
@throttle_classes([PartnerRateThrottle])
def partner_application_events(request):
    """Disclose application events for one person and time period.

    Partner systems authenticate with `Authorization: Api-Key <key>`.
    Every call is audit logged as a partner disclosure.
    """
    person = normalize_personal_number(request.query_params.get("person", ""))
    if person is None:
        raise ValidationError(
            {"person": "Required: a 12-digit personal identity number."}
        )
    date_from = _date_param(request.query_params, "from")
    date_to = _date_param(request.query_params, "to")

    # Unknown persons yield an empty list, indistinguishable from a person
    # without events — the endpoint never reveals who has an account.
    person_hash = pseudonymize_personal_number(person)
    profile = ApplicantProfile.objects.filter(personal_number_hash=person_hash).first()

    if profile is None:
        events = []
    else:
        qs = (
            JobApplication.objects.select_related("posting")
            .filter(owner=profile.user)
            .order_by("applied_at")
        )
        if date_from:
            qs = qs.filter(applied_at__gte=date_from)
        if date_to:
            qs = qs.filter(applied_at__lte=date_to)
        events = list(qs)

    log_event(
        None,
        AuditLog.ACTION_PARTNER_DISCLOSED,
        partner_client_id=request.auth.id,
        partner_name=request.auth.name,
        person_hash=person_hash,
        date_from=str(date_from) if date_from else None,
        date_to=str(date_to) if date_to else None,
        application_count=len(events),
    )
    serializer = PartnerApplicationEventSerializer(events, many=True)
    return Response(serializer.data)
