import csv
import hashlib
import json
import os
from datetime import timedelta
from types import SimpleNamespace

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, viewsets
from rest_framework import status as drf_status
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.email_health import email_delivery_warnings

from .csv_safety import sanitize_csv_cell
from .experience_skills import (
    merge_skill_suggestions,
    skills_list_to_suggestions,
    suggest_evidence_by_source,
    suggest_skills_from_experience,
)
from .job_profiles import (
    active_profile,
    confirmed_evidence,
    normalize_job_profiles,
    profile_skill_terms,
    profiles_from_skill_groups,
)
from .jobtech import (
    OCCUPATION_FIELDS,
    REGIONS,
    JobTechError,
    fetch_ad,
    municipalities,
    occupation_groups,
)
from .jobtech import search as jobtech_search
from .matching import match_evidence, match_skills
from .models import JobApplication, Resume, SavedJobSearch
from .permissions import IsAuthenticatedUser
from .resume import (
    MAX_UPLOAD_SIZE,
    SUPPORTED_EXTENSIONS,
    extract_text,
    parse_resume_text,
)
from .serializers import (
    ApplicationEventSerializer,
    JobApplicationListSerializer,
    JobApplicationSerializer,
    ProfileSerializer,
    ResumeSerializer,
    ResumeUploadSerializer,
    SavedJobSearchSerializer,
)
from .skill_groups import (
    EMPTY_SKILL_GROUPS,
    normalize_skill_groups,
    skill_groups_from_flat,
)
from .throttles import JobTechThrottle, UploadThrottle


def _resume_match_context(user) -> dict:
    """Skills and evidence from the user's active job profile."""
    resume = Resume.objects.filter(user=user).first()
    if not resume:
        return {"cv_skills": [], "cv_evidence": []}
    try:
        profiles = normalize_job_profiles(resume.job_profiles, headline=resume.headline)
    except ValueError:
        profiles = []
    has_evidence = any(profile.get("evidence") for profile in profiles)
    if not has_evidence:
        groups = normalize_skill_groups(resume.skill_groups or {})
        if any(groups.values()):
            profiles = profiles_from_skill_groups(groups, headline=resume.headline)
        elif resume.skills:
            profiles = profiles_from_skill_groups(
                skill_groups_from_flat(resume.skills),
                headline=resume.headline,
            )
        else:
            profiles = normalize_job_profiles(profiles or [], headline=resume.headline)
    if not profiles:
        return {"cv_skills": [], "cv_evidence": []}
    profile = active_profile(profiles)
    evidence = confirmed_evidence(profile)
    return {
        "cv_skills": profile_skill_terms(profile),
        "cv_evidence": evidence,
    }


@extend_schema(
    responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}}
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    """Public health check endpoint."""
    payload = {"status": "ok"}
    warnings = email_delivery_warnings(debug=settings.DEBUG)
    if warnings:
        payload["warnings"] = warnings
    return Response(payload)


@extend_schema(exclude=True)  # serves JS for the SPA, not part of the API
@api_view(["GET"])
@permission_classes([AllowAny])
def runtime_config(_request):
    """Small JS snippet for optional frontend runtime config (e.g. Sentry DSN)."""
    payload = {
        "sentryDsn": os.getenv("SENTRY_DSN_FRONTEND", "")
        or os.getenv("SENTRY_DSN", ""),
        "sentryEnvironment": os.getenv(
            "SENTRY_ENVIRONMENT", "development" if settings.DEBUG else "production"
        ),
        # Empty when Google login is not configured; the SPA hides the button.
        "googleClientId": settings.GOOGLE_CLIENT_ID,
        # Shown in the privacy policy as the controller contact address.
        "contactEmail": settings.CONTACT_EMAIL,
    }
    body = f"window.__ANSOKT_CONFIG__={json.dumps(payload)};"
    return HttpResponse(
        body,
        content_type="application/javascript; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def security_txt(_request):
    """RFC 9116 security.txt — a contact channel for vulnerability reports."""
    if not settings.CONTACT_EMAIL:
        raise Http404
    expires = timezone.now() + timedelta(days=365)
    body = "\n".join(
        [
            f"Contact: mailto:{settings.CONTACT_EMAIL}",
            f"Expires: {expires.strftime('%Y-%m-%dT%H:%M:%SZ')}",
            "Preferred-Languages: sv, en",
        ]
    )
    return HttpResponse(body + "\n", content_type="text/plain; charset=utf-8")


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
    pagination_class = None

    def get_queryset(self):
        return SavedJobSearch.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class SavedJobSearchDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SavedJobSearchSerializer
    permission_classes = [IsAuthenticatedUser]
    http_method_names = ["get", "patch", "delete", "head", "options"]

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

        draft = parse_resume_text(text)
        parsed_skills = draft.get("skills", [])
        draft["skills"] = []
        draft["skill_groups"] = dict(EMPTY_SKILL_GROUPS)
        cv_suggestions = skills_list_to_suggestions(
            parsed_skills,
            source="CV: kompetenssektion",
        )
        exp_suggestions = suggest_skills_from_experience(
            draft.get("experience", []),
            existing_groups={},
        )
        draft["skill_suggestions"] = merge_skill_suggestions(
            cv_suggestions,
            exp_suggestions,
        )
        draft["evidence_suggestions"] = suggest_evidence_by_source(
            draft.get("experience", []),
            draft.get("education", []),
            profile_evidence=[],
            parsed_skills=parsed_skills,
        )
        draft["job_profiles"] = []
        return Response(draft)


class ResumeSuggestEvidenceView(APIView):
    """Suggest evidence terms keyed by CV source row."""

    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        experience = request.data.get("experience", [])
        education = request.data.get("education", [])
        if not isinstance(experience, list):
            raise ValidationError({"experience": "Expected a list."})
        if not isinstance(education, list):
            raise ValidationError({"education": "Expected a list."})
        profile_id = request.data.get("active_profile_id")
        profiles_raw = request.data.get("job_profiles")
        try:
            profiles = normalize_job_profiles(
                profiles_raw if profiles_raw is not None else [],
                headline=str(request.data.get("headline") or ""),
            )
        except ValueError as exc:
            raise ValidationError({"job_profiles": str(exc)}) from exc
        profile = active_profile(profiles)
        if profile_id:
            for candidate in profiles:
                if candidate.get("id") == profile_id:
                    profile = candidate
                    break
        return Response(
            {
                "by_source": suggest_evidence_by_source(
                    experience,
                    education,
                    profile_evidence=profile.get("evidence", []),
                )
            }
        )


class ResumeSuggestSkillsView(APIView):
    """Suggest categorized skills extracted from experience rows."""

    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        experience = request.data.get("experience", [])
        if not isinstance(experience, list):
            raise ValidationError({"experience": "Expected a list."})
        try:
            groups = normalize_skill_groups(request.data.get("skill_groups", {}))
        except ValueError as exc:
            raise ValidationError({"skill_groups": str(exc)}) from exc
        return Response(
            {
                "suggestions": suggest_skills_from_experience(
                    experience,
                    existing_groups=groups,
                )
            }
        )


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

    def get_serializer_class(self):
        if self.action == "list":
            return JobApplicationListSerializer
        return JobApplicationSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "list" and self.request.user.is_authenticated:
            context.update(_resume_match_context(self.request.user))
        return context

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobApplication.objects.none()
        qs = JobApplication.objects.filter(owner=self.request.user).order_by(
            "-updated_at"
        )
        if self.action == "list":
            qs = qs.select_related("posting")
        else:
            qs = qs.prefetch_related("events")
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

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=["get"], url_path="tracked-urls")
    def tracked_urls(self, request):
        """All ad URLs on the user's board — lets the ad search mark
        already-saved ads without downloading every application row."""
        urls = (
            JobApplication.objects.filter(owner=request.user)
            .exclude(ad_url="")
            .values_list("ad_url", flat=True)
        )
        return Response({"urls": list(urls)})

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


def _truthy(value):
    return str(value).lower() in ("1", "true", "yes", "on")


GOOD_MATCH_PERCENT = 40


def _parse_id_list(params, *keys):
    """Collect unique concept IDs from repeated or comma-separated query params."""
    ids: list[str] = []
    seen: set[str] = set()
    for key in keys:
        for value in params.getlist(key):
            for part in value.split(","):
                part = part.strip()
                if part and part not in seen:
                    seen.add(part)
                    ids.append(part)
    return ids


def _filter_jobs_by_cv_match(results, *, min_percent=GOOD_MATCH_PERCENT):
    filtered = []
    for job in results:
        match = job.get("match")
        if not match or not match.get("total"):
            continue
        if (match["count"] / match["total"]) * 100 >= min_percent:
            filtered.append(job)
    return filtered


JOBTECH_CACHE_TTL = 180  # seconds


def _cached_jobtech_search(**kwargs):
    """JobTech search with a short shared cache.

    Search results are user-independent (CV matching is applied after),
    so identical queries within the TTL are served without another
    round trip to Platsbanken.
    """
    raw_key = json.dumps(kwargs, sort_keys=True)
    cache_key = "jobtech:search:" + hashlib.sha256(raw_key.encode()).hexdigest()
    data = cache.get(cache_key)
    if data is None:
        data = jobtech_search(**kwargs)
        cache.set(cache_key, data, JOBTECH_CACHE_TTL)
    return data


@extend_schema(
    parameters=[
        OpenApiParameter("q", OpenApiTypes.STR, description="Free text query."),
        OpenApiParameter(
            "region",
            OpenApiTypes.STR,
            description="Region concept id (repeatable).",
        ),
        OpenApiParameter(
            "municipality",
            OpenApiTypes.STR,
            description="Municipality concept id (repeatable).",
        ),
        OpenApiParameter(
            "field",
            OpenApiTypes.STR,
            description="Occupation-field concept id (repeatable).",
        ),
        OpenApiParameter(
            "group",
            OpenApiTypes.STR,
            description="Occupation-group concept id (repeatable).",
        ),
        OpenApiParameter("remote", OpenApiTypes.BOOL, description="Remote only."),
        OpenApiParameter(
            "match_cv",
            OpenApiTypes.BOOL,
            description="Only jobs that match the user's CV (≥40%).",
        ),
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
        data = _cached_jobtech_search(
            q=params.get("q", ""),
            regions=_parse_id_list(params, "region", "regions"),
            municipalities=_parse_id_list(params, "municipality", "municipalities"),
            fields=_parse_id_list(params, "field", "fields"),
            groups=_parse_id_list(params, "group", "groups"),
            remote=_truthy(params.get("remote", "")),
            offset=offset,
            limit=limit,
        )
    except JobTechError:
        return Response(
            {"detail": "Kunde inte nå Platsbanken just nu. Försök igen strax."},
            status=drf_status.HTTP_502_BAD_GATEWAY,
        )

    match_ctx = _resume_match_context(request.user)
    skills = match_ctx["cv_skills"] or None
    evidence = match_ctx["cv_evidence"] or None
    if evidence or skills:
        for job in data["results"]:
            posting = SimpleNamespace(
                title=job["title"], description=job["description"]
            )
            if evidence:
                job["match"] = match_evidence(evidence, posting)
            else:
                job["match"] = match_skills(skills, posting)

    if _truthy(params.get("match_cv", "")):
        if not skills:
            raise ValidationError(
                {
                    "match_cv": (
                        "Markera kompetenser i CV:t för att filtrera på matchning."
                    )
                }
            )
        data["results"] = _filter_jobs_by_cv_match(data["results"])
        data["match_cv_filtered"] = True

    data["offset"] = offset
    data["limit"] = limit
    return Response(data)


@extend_schema(responses={200: OpenApiTypes.OBJECT})
@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
@throttle_classes([JobTechThrottle])
def job_detail(_request, job_id):
    """Fetch one Platsbanken ad by JobTech id (for ad text refresh)."""
    try:
        job = fetch_ad(job_id)
    except JobTechError:
        return Response(
            {"detail": "Kunde inte hämta annonsen just nu."},
            status=drf_status.HTTP_502_BAD_GATEWAY,
        )
    return Response(job)


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
