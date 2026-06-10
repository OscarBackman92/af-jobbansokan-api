import csv

from django.db.models import Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .audit import log_event
from .identity import normalize_personal_number, pseudonymize_personal_number
from .models import (
    ApplicantProfile,
    AuditLog,
    EmployerProfile,
    JobApplication,
    JobPosting,
    Resume,
)
from .partner_auth import IsPartner, PartnerAPIKeyAuthentication
from .permissions import IsEmployer, IsEmployerAdminOrReadOnly
from .resume import (
    MAX_UPLOAD_SIZE,
    SUPPORTED_EXTENSIONS,
    extract_text,
    parse_resume_text,
)
from .serializers import (
    DisclosureSerializer,
    EmployerApplicationStatusSerializer,
    EmployerJobApplicationSerializer,
    JobApplicationSerializer,
    JobPostingDetailSerializer,
    JobPostingSerializer,
    OrganizationSerializer,
    PartnerApplicationEventSerializer,
    ProfileSerializer,
    ResumeSerializer,
    ResumeUploadSerializer,
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


class ResumeView(generics.RetrieveUpdateDestroyAPIView):
    """The authenticated user's structured CV (created empty on first GET)."""

    serializer_class = ResumeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        resume, _ = Resume.objects.get_or_create(user=self.request.user)
        return resume


class ResumeParseView(APIView):
    """Parse an uploaded CV (PDF/DOCX/TXT) into a structured draft.

    The file is processed in memory and never stored; nothing is saved
    until the user reviews the prefilled form and submits it.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @extend_schema(
        request=ResumeUploadSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        serializer = ResumeUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]

        if upload.size > MAX_UPLOAD_SIZE:
            raise ValidationError({"file": "Max file size is 2 MB."})
        if not upload.name.lower().endswith(SUPPORTED_EXTENSIONS):
            raise ValidationError({"file": "Supported formats: PDF, DOCX and TXT."})

        try:
            text = extract_text(upload.name, upload.read())
        except ValueError as exc:
            raise ValidationError({"file": str(exc)}) from exc
        except Exception as exc:  # corrupt/unreadable file
            raise ValidationError({"file": "The file could not be read."}) from exc

        return Response(parse_resume_text(text))


class MyDisclosuresView(generics.ListAPIView):
    """Transparency: partner disclosures of the user's own data.

    Matches the audit trail on the user's pseudonymized identity, so it
    requires a verified (BankID) identity. Users without one have never
    been disclosed to partners and get an empty list.
    """

    serializer_class = DisclosureSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return AuditLog.objects.none()
        profile = getattr(self.request.user, "applicant_profile", None)
        if profile is None:
            return AuditLog.objects.none()
        return AuditLog.objects.filter(
            action=AuditLog.ACTION_PARTNER_DISCLOSED,
            metadata__person_hash=profile.personal_number_hash,
        ).order_by("-created_at")


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

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.STR})
    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """Download own application events as CSV (filters apply)."""
        qs = self.get_queryset().select_related("posting")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="ansokningar.csv"'
        response.write("\ufeff")  # BOM so Excel detects UTF-8
        writer = csv.writer(response)
        writer.writerow(
            ["id", "applied_at", "status", "posting", "company", "created_at"]
        )
        for application in qs:
            writer.writerow(
                [
                    application.id,
                    application.applied_at,
                    application.status,
                    application.posting.title,
                    application.posting.company_name,
                    application.created_at.isoformat(),
                ]
            )
        return response


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "search",
                OpenApiTypes.STR,
                description="Free text over title, company, location and description.",
            ),
            OpenApiParameter(
                "location", OpenApiTypes.STR, description="Filter by location."
            ),
            OpenApiParameter(
                "source", OpenApiTypes.STR, description="Filter by source."
            ),
        ]
    )
)
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
        qs = JobPosting.objects.all().order_by("-created_at")
        params = self.request.query_params

        # icontains works on SQLite and Postgres alike; upgrade path to
        # Postgres FTS when volume demands it (docs/09, phase 1).
        search = params.get("search", "").strip()
        for term in search.split()[:6]:
            qs = qs.filter(
                Q(title__icontains=term)
                | Q(company_name__icontains=term)
                | Q(location__icontains=term)
                | Q(description__icontains=term)
            )

        location = params.get("location", "").strip()
        if location:
            qs = qs.filter(location__icontains=location)
        source = params.get("source", "").strip()
        if source:
            qs = qs.filter(source=source)
        return qs

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
