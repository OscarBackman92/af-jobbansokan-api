import csv
import json
import os
from types import SimpleNamespace

from django.conf import settings

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, viewsets
from rest_framework import status as drf_status
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny

from .permissions import IsAuthenticatedUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .csv_safety import sanitize_csv_cell
from .jobtech import (
    OCCUPATION_FIELDS,
    REGIONS,
    JobTechError,
    municipalities,
    occupation_groups,
)
from .jobtech import search as jobtech_search
from .throttles import JobTechThrottle, UploadThrottle
from .matching import match_skills
from .models import JobApplication, JobPosting, Resume, SavedJobSearch
from .resume import (
    MAX_UPLOAD_SIZE,
    SUPPORTED_EXTENSIONS,
    extract_text,
    parse_resume_text,
)
from .serializers import (
    ApplicationEventSerializer,
    JobApplicationSerializer,
    JobPostingDetailSerializer,
    JobPostingSerializer,
    ProfileSerializer,
    ResumeSerializer,
    ResumeUploadSerializer,
    SavedJobSearchSerializer,
    StatusCountSerializer,
)


@extend_schema(
    responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}}
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    """Public health check endpoint."""
    payload = {"status": "ok"}
    if not settings.DEBUG and not os.getenv("EMAIL_HOST"):
        payload["warnings"] = ["email_not_configured"]
    return Response(payload)


@api_view(["GET"])
@permission_classes([AllowAny])
def runtime_config(_request):
    """Small JS snippet for optional frontend runtime config (e.g. Sentry DSN)."""
    payload = {
        "sentryDsn": os.getenv("SENTRY_DSN_FRONTEND", "") or os.getenv("SENTRY_DSN", ""),
        "sentryEnvironment": os.getenv(
            "SENTRY_ENVIRONMENT", "development" if settings.DEBUG else "production"
        ),
    }
    body = f"window.__ANSOKT_CONFIG__={json.dumps(payload)};"
    return HttpResponse(
        body,
        content_type="application/javascript; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


class ProfileView(generics.RetrieveUpdateDestroyAPIView):
    """The authenticated user's own profile.

    GET returns contact details. PATCH updates them. DELETE erases the
    account and everything it owns (GDPR right to erasure).
    """

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticatedUser]

    def get_object(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.select_related("operator_profile").get(
            pk=self.request.user.pk
        )


class ResumeView(generics.RetrieveUpdateDestroyAPIView):
    """The authenticated user's structured CV (created empty on first GET)."""

    serializer_class = ResumeSerializer
    permission_classes = [IsAuthenticatedUser]

    def get_object(self):
        resume, _ = Resume.objects.get_or_create(user=self.request.user)
        return resume


class SavedJobSearchListCreateView(generics.ListCreateAPIView):
    """List or save Platsbanken search presets for the current user."""

    serializer_class = SavedJobSearchSerializer
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        return SavedJobSearch.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class SavedJobSearchDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SavedJobSearchSerializer
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        return SavedJobSearch.objects.filter(owner=self.request.user)


class ResumeParseView(APIView):
    """Parse an uploaded CV (PDF/DOCX/TXT) into a structured draft.

    The file is processed in memory and never stored; nothing is saved
    until the user reviews the prefilled form and submits it.
    """

    permission_classes = [IsAuthenticatedUser]
    parser_classes = [MultiPartParser]
    throttle_classes = [UploadThrottle]

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
            OpenApiParameter(
                "search",
                OpenApiTypes.STR,
                description="Free text over company, title and notes.",
            ),
        ]
    )
)
class JobApplicationViewSet(viewsets.ModelViewSet):
    """The user's application tracker rows. Full CRUD on own rows only.

    A status change automatically appends a timeline event, so the
    history stays complete without extra bookkeeping.
    """

    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobApplication.objects.none()
        qs = (
            JobApplication.objects.filter(owner=self.request.user)
            .prefetch_related("events")
            .order_by("-updated_at")
        )
        params = self.request.query_params
        date_from = _date_param(params, "from")
        date_to = _date_param(params, "to")
        if date_from:
            qs = qs.filter(applied_at__gte=date_from)
        if date_to:
            qs = qs.filter(applied_at__lte=date_to)
        status_value = params.get("status")
        if status_value:
            qs = qs.filter(status=status_value)
        search = params.get("search", "").strip()
        for term in search.split()[:6]:
            qs = qs.filter(
                Q(company__icontains=term)
                | Q(title__icontains=term)
                | Q(notes__icontains=term)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        application = serializer.save()
        if previous != application.status:
            application.events.create(
                occurred_at=self.request.data.get("status_changed_at")
                or application.updated_at.date(),
                note=(
                    f"Status: {dict(JobApplication.STATUS_CHOICES)[previous]}"
                    f" → {application.get_status_display()}"
                ),
                status=application.status,
            )

    @extend_schema(
        request=ApplicationEventSerializer,
        responses={201: ApplicationEventSerializer},
    )
    @action(detail=True, methods=["post"], url_path="events")
    def add_event(self, request, pk=None):
        """Append a note/event to the application's timeline."""
        application = self.get_object()
        serializer = ApplicationEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(application=application)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)

    @extend_schema(responses=StatusCountSerializer(many=True))
    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Application counts per status, for the dashboard."""
        counts = dict(
            JobApplication.objects.filter(owner=request.user)
            .values_list("status")
            .annotate(count=Count("id"))
        )
        data = [
            {"status": value, "label": label, "count": counts.get(value, 0)}
            for value, label in JobApplication.STATUS_CHOICES
        ]
        return Response(data)

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.STR})
    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """Download the tracker as CSV (filters apply)."""
        qs = self.get_queryset()
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="ansokningar.csv"'
        response.write("﻿")  # BOM so Excel detects UTF-8
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "company",
                "title",
                "location",
                "status",
                "applied_at",
                "deadline",
                "contact_name",
                "contact_info",
                "next_action_at",
                "ad_url",
                "notes",
            ]
        )
        for app in qs:
            writer.writerow(
                [
                    app.id,
                    sanitize_csv_cell(app.company),
                    sanitize_csv_cell(app.title),
                    sanitize_csv_cell(app.location),
                    sanitize_csv_cell(app.get_status_display()),
                    app.applied_at or "",
                    app.deadline or "",
                    sanitize_csv_cell(app.contact_name),
                    sanitize_csv_cell(app.contact_info),
                    app.next_action_at or "",
                    sanitize_csv_cell(app.ad_url),
                    sanitize_csv_cell(app.notes),
                ]
            )
        return response


class PostingPagination(PageNumberPagination):
    """Larger pages for browsing ads, with an optional ?page_size override."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


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
        ]
    )
)
class JobPostingViewSet(viewsets.ReadOnlyModelViewSet):
    """Imported job ads (JobTech). Read-only; rows are created by import."""

    permission_classes = [IsAuthenticatedUser]
    pagination_class = PostingPagination

    def get_serializer_class(self):
        # Lean list payloads; full posting (description, link) in detail.
        if self.action == "list":
            return JobPostingSerializer
        return JobPostingDetailSerializer

    def _user_skills(self, request):
        resume = getattr(request.user, "resume", None)
        skills = resume.skills if resume else []
        return skills or None

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        data = self.get_serializer(page, many=True).data
        skills = self._user_skills(request)
        if skills:
            postings = {posting.id: posting for posting in page}
            for item in data:
                item["match"] = match_skills(skills, postings[item["id"]])
        return self.get_paginated_response(data)

    def retrieve(self, request, *args, **kwargs):
        posting = self.get_object()
        data = self.get_serializer(posting).data
        skills = self._user_skills(request)
        if skills:
            data["match"] = match_skills(skills, posting)
        return Response(data)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobPosting.objects.none()
        qs = JobPosting.objects.all().order_by("-created_at")
        params = self.request.query_params

        # icontains works on SQLite and Postgres alike; upgrade path to
        # Postgres FTS when volume demands it.
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
        return qs


def _truthy(value):
    return str(value).lower() in ("1", "true", "yes", "on")


@extend_schema(
    parameters=[
        OpenApiParameter("q", OpenApiTypes.STR, description="Free text query."),
        OpenApiParameter("region", OpenApiTypes.STR, description="Region concept id."),
        OpenApiParameter(
            "municipality", OpenApiTypes.STR, description="Municipality concept id."
        ),
        OpenApiParameter(
            "field", OpenApiTypes.STR, description="Occupation-field concept id."
        ),
        OpenApiParameter(
            "group", OpenApiTypes.STR, description="Occupation-group concept id."
        ),
        OpenApiParameter("remote", OpenApiTypes.BOOL, description="Remote only."),
        OpenApiParameter("offset", OpenApiTypes.INT),
        OpenApiParameter("limit", OpenApiTypes.INT),
    ],
    responses={200: OpenApiTypes.OBJECT},
)
@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
@throttle_classes([JobTechThrottle])
def job_search(request):
    """Live search of Platsbanken via JobTech, with optional CV matching."""
    params = request.query_params
    try:
        offset = int(params.get("offset", 0))
        limit = int(params.get("limit", 25))
    except ValueError as exc:
        raise ValidationError({"detail": "offset/limit must be integers."}) from exc

    try:
        data = jobtech_search(
            q=params.get("q", ""),
            region=params.get("region", ""),
            municipality=params.get("municipality", ""),
            field=params.get("field", ""),
            group=params.get("group", ""),
            remote=_truthy(params.get("remote", "")),
            offset=offset,
            limit=limit,
        )
    except JobTechError:
        return Response(
            {"detail": "Kunde inte nå Platsbanken just nu. Försök igen strax."},
            status=drf_status.HTTP_502_BAD_GATEWAY,
        )

    resume = getattr(request.user, "resume", None)
    skills = (resume.skills if resume else None) or None
    if skills:
        for job in data["results"]:
            job["match"] = match_skills(
                skills,
                SimpleNamespace(title=job["title"], description=job["description"]),
            )

    data["offset"] = offset
    data["limit"] = limit
    return Response(data)


@extend_schema(responses={200: OpenApiTypes.OBJECT})
@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
def job_filters(_request):
    """Region and occupation-field options for the ad-search dropdowns."""
    return Response(
        {
            "regions": [{"id": cid, "label": label} for cid, label in REGIONS],
            "fields": [{"id": cid, "label": label} for cid, label in OCCUPATION_FIELDS],
        }
    )


@extend_schema(
    parameters=[
        OpenApiParameter(
            "field", OpenApiTypes.STR, description="Occupation-field concept id."
        ),
    ],
    responses={200: OpenApiTypes.OBJECT},
)
@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
@throttle_classes([JobTechThrottle])
def job_groups(request):
    """Occupation-group options for one selected occupation field."""
    try:
        groups = occupation_groups(request.query_params.get("field", ""))
    except JobTechError:
        return Response(
            {"detail": "Kunde inte hämta yrken från Platsbanken just nu."},
            status=drf_status.HTTP_502_BAD_GATEWAY,
        )
    return Response({"groups": groups})


@extend_schema(
    parameters=[
        OpenApiParameter("region", OpenApiTypes.STR, description="Region concept id."),
    ],
    responses={200: OpenApiTypes.OBJECT},
)
@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
@throttle_classes([JobTechThrottle])
def job_municipalities(request):
    """Municipality options for one selected region."""
    try:
        locations = municipalities(request.query_params.get("region", ""))
    except JobTechError:
        return Response(
            {"detail": "Kunde inte hämta orter från Platsbanken just nu."},
            status=drf_status.HTTP_502_BAD_GATEWAY,
        )
    return Response({"municipalities": locations})
