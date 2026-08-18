import csv
import hashlib
import json
import logging
import os
from datetime import timedelta
from types import SimpleNamespace

from django.conf import settings
from django.core.cache import cache
from django.db.models import Exists, Max, OuterRef, Q
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

logger = logging.getLogger(__name__)

from .csv_safety import sanitize_csv_cell
from .dashboard import build_dashboard
from .experience_skills import (
    merge_skill_suggestions,
    skills_list_to_suggestions,
    suggest_evidence_by_source,
    suggest_skills_from_experience,
)
from .insights import build_skill_insights
from .job_profiles import (
    active_profile,
    add_evidence_to_profile,
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
from .match_snapshot import score_and_store
from .matching import match_evidence, match_skills
from .models import ApplicationEvent, JobApplication, Resume, SavedJobSearch
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
        return {"cv_skills": [], "cv_evidence": [], "resume": None}
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
        return {"cv_skills": [], "cv_evidence": [], "resume": resume}
    profile = active_profile(profiles)
    evidence = confirmed_evidence(profile)
    return {
        "cv_skills": profile_skill_terms(profile),
        "cv_evidence": evidence,
        "resume": resume,
    }


def _drop_prefetched_events(application):
    """Newly created timeline rows must be visible on the same response."""
    prefetched = getattr(application, "_prefetched_objects_cache", None)
    if prefetched is not None:
        prefetched.pop("events", None)


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


class DashboardView(APIView):
    """Single-call overview metrics for the Översikt tab."""

    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response(build_dashboard(request.user))


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
                    headline=str(request.data.get("headline") or ""),
                    summary=str(request.data.get("summary") or ""),
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


class ResumeAddEvidenceView(APIView):
    """Add one evidence term to the active job profile (+ har det)."""

    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: ResumeSerializer})
    def post(self, request):
        term = str(request.data.get("term") or "").strip()
        category = str(request.data.get("category") or "technical").strip()
        if not term:
            raise ValidationError({"term": "Required."})
        if category not in ("technical", "domain", "languages"):
            raise ValidationError(
                {"category": "Must be technical, domain or languages."}
            )
        source = request.data.get("source") or {
            "type": "manual",
            "label": "Från annons",
        }
        if not isinstance(source, dict):
            raise ValidationError({"source": "Expected an object."})

        resume, _ = Resume.objects.get_or_create(user=request.user)
        try:
            profiles = normalize_job_profiles(
                resume.job_profiles or [], headline=resume.headline or ""
            )
        except ValueError as exc:
            raise ValidationError({"job_profiles": str(exc)}) from exc
        profile = active_profile(profiles)
        updated = add_evidence_to_profile(
            profile,
            term=term,
            category=category,
            source=source,
            confirmed=True,
        )
        for index, candidate in enumerate(profiles):
            if candidate.get("id") == updated.get("id"):
                profiles[index] = updated
                break
        else:
            profiles[0] = updated
        resume.job_profiles = profiles
        resume.save(update_fields=["job_profiles", "updated_at"])
        return Response(ResumeSerializer(resume, context={"request": request}).data)


class SkillsInsightsView(APIView):
    """Aggregated skill gaps/hits from stored match snapshots."""

    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response(build_skill_insights(request.user))


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
            OpenApiParameter(
                "archived",
                OpenApiTypes.BOOL,
                description="When true, list soft-archived rows only.",
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
        if self.request.user.is_authenticated and self.action in (
            "list",
            "retrieve",
            "create",
            "update",
            "partial_update",
        ):
            context.update(_resume_match_context(self.request.user))
        return context

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return JobApplication.objects.none()
        qs = JobApplication.objects.filter(owner=self.request.user).order_by(
            "-updated_at"
        )
        # Soft-archive: default list/detail hide archived; ?archived=1 shows them.
        if self.action not in ("tracked_urls", "bulk"):
            if _truthy(self.request.query_params.get("archived")):
                qs = qs.filter(archived_at__isnull=False)
            else:
                qs = qs.filter(archived_at__isnull=True)
        if self.action == "list":
            funnel_statuses = [
                JobApplication.STATUS_SCREENING,
                JobApplication.STATUS_INTERVIEW,
                JobApplication.STATUS_FORWARDED,
                JobApplication.STATUS_OFFER,
                JobApplication.STATUS_ACCEPTED,
            ]
            qs = qs.select_related("posting").annotate(
                _last_event_at=Max("events__occurred_at"),
                reached_interview=Exists(
                    ApplicationEvent.objects.filter(
                        application_id=OuterRef("pk"),
                        status__in=funnel_statuses,
                    )
                ),
            )
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
        application = serializer.save(owner=self.request.user)
        score_and_store(application, user=self.request.user)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        application = serializer.save()
        if previous != application.status:
            occurred_at = (
                parse_date(str(self.request.data.get("status_changed_at") or ""))
                or timezone.localdate()
            )
            # Moving into "Ansökt" without a date leaves the stats chart
            # empty — stamp applied_at from the status change when missing.
            if (
                application.status == JobApplication.STATUS_APPLIED
                and not application.applied_at
            ):
                application.applied_at = occurred_at
                application.save(update_fields=["applied_at", "updated_at"])
            application.events.create(
                occurred_at=occurred_at,
                note=(
                    f"Status: {dict(JobApplication.STATUS_CHOICES)[previous]}"
                    f" → {application.get_status_display()}"
                ),
                status=application.status,
            )
            _drop_prefetched_events(application)
            if application.status == JobApplication.STATUS_APPLIED:
                score_and_store(application, user=self.request.user)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=["get"], url_path="tracked-urls")
    def tracked_urls(self, request):
        """All ad URLs on the user's board — lets the ad search mark
        already-saved ads without downloading every application row.

        Includes archived rows so soft-delete cannot bypass duplicate protection.
        """
        urls = (
            JobApplication.objects.filter(owner=request.user)
            .exclude(ad_url="")
            .values_list("ad_url", flat=True)
        )
        return Response({"urls": list(urls)})

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=["get"], url_path="saved-summary")
    def saved_summary(self, request):
        """Lane counts for the Sparade jobb page (wishlist, not archived)."""
        today = timezone.localdate()
        base = JobApplication.objects.filter(
            owner=request.user,
            status=JobApplication.STATUS_WISHLIST,
            archived_at__isnull=True,
        )
        total = base.count()
        paused = base.filter(intent=JobApplication.INTENT_PAUSED).count()
        rest = base.exclude(intent=JobApplication.INTENT_PAUSED)
        expired = rest.filter(apply_by__lt=today).count()
        future = rest.filter(apply_by__gte=today)
        auto_no_deadline = Q(deadline__isnull=True, apply_by_is_auto=True)
        no_deadline = future.filter(auto_no_deadline).count()
        planned = future.exclude(auto_no_deadline)
        urgent_end = today + timedelta(days=7)
        urgent = planned.filter(apply_by__lte=urgent_end).count()
        this_month = planned.filter(apply_by__gt=urgent_end).count()
        return Response(
            {
                "total": total,
                "urgent": urgent,
                "this_month": this_month,
                "no_deadline": no_deadline,
                "paused": paused,
                "expired": expired,
            }
        )

    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "ids": {"type": "array", "items": {"type": "integer"}},
                    "action": {
                        "type": "string",
                        "enum": [
                            "mark_applied",
                            "archive",
                            "pause",
                            "activate",
                            "set_apply_by",
                        ],
                    },
                    "date": {"type": "string", "format": "date"},
                },
                "required": ["ids", "action"],
            }
        },
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Idempotent bulk actions on the caller's own application ids."""
        ids = request.data.get("ids")
        action_name = request.data.get("action")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": "Provide a non-empty list of ids."})
        try:
            ids = [int(value) for value in ids]
        except (TypeError, ValueError) as exc:
            raise ValidationError({"ids": "Ids must be integers."}) from exc
        ids = list(dict.fromkeys(ids))

        allowed = {
            "mark_applied",
            "archive",
            "pause",
            "activate",
            "set_apply_by",
        }
        if action_name not in allowed:
            raise ValidationError(
                {"action": f"Must be one of: {', '.join(sorted(allowed))}."}
            )

        date_raw = request.data.get("date")
        occurred_at = parse_date(str(date_raw)) if date_raw not in (None, "") else None
        if date_raw not in (None, "") and occurred_at is None:
            raise ValidationError({"date": "Invalid date, expected YYYY-MM-DD."})
        if occurred_at is None:
            occurred_at = timezone.localdate()
        if action_name == "set_apply_by" and date_raw in (None, ""):
            raise ValidationError({"date": "Required for set_apply_by."})

        apps = list(
            JobApplication.objects.filter(owner=request.user, id__in=ids).order_by("id")
        )
        if len(apps) != len(ids):
            raise ValidationError({"ids": "One or more applications were not found."})

        updated = []
        status_labels = dict(JobApplication.STATUS_CHOICES)
        for app in apps:
            if action_name == "mark_applied":
                previous = app.status
                if previous != JobApplication.STATUS_APPLIED:
                    app.status = JobApplication.STATUS_APPLIED
                    if not app.applied_at:
                        app.applied_at = occurred_at
                    app.save()
                    app.events.create(
                        occurred_at=occurred_at,
                        note=(
                            f"Status: {status_labels[previous]}"
                            f" → {app.get_status_display()}"
                        ),
                        status=JobApplication.STATUS_APPLIED,
                    )
                    score_and_store(app, user=request.user)
                updated.append(app.id)
            elif action_name == "archive":
                if app.archived_at is None:
                    app.archived_at = timezone.now()
                    app.save(update_fields=["archived_at", "updated_at"])
                updated.append(app.id)
            elif action_name == "pause":
                if app.intent != JobApplication.INTENT_PAUSED:
                    app.intent = JobApplication.INTENT_PAUSED
                    app.save(update_fields=["intent", "updated_at"])
                updated.append(app.id)
            elif action_name == "activate":
                if app.intent != JobApplication.INTENT_ACTIVE:
                    app.intent = JobApplication.INTENT_ACTIVE
                    app.save(update_fields=["intent", "updated_at"])
                updated.append(app.id)
            elif action_name == "set_apply_by":
                app.apply_by = occurred_at
                app.apply_by_is_auto = False
                app.save(update_fields=["apply_by", "apply_by_is_auto", "updated_at"])
                updated.append(app.id)

        return Response({"updated": updated})

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
                "intent",
                "applied_at",
                "deadline",
                "apply_by",
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
                    sanitize_csv_cell(app.get_intent_display()),
                    app.applied_at or "",
                    app.deadline or "",
                    app.apply_by or "",
                    sanitize_csv_cell(app.contact_name),
                    sanitize_csv_cell(app.contact_info),
                    app.next_action_at or "",
                    sanitize_csv_cell(app.ad_url),
                    sanitize_csv_cell(app.notes),
                ]
            )
        return response


GOOD_MATCH_PERCENT = 60
GOOD_MATCH_MIN_TERMS = 2
# Bounded scan: 4 JobTech pages × 25 ads. Keep well under gunicorn timeout.
MATCH_CV_SCAN_LIMIT = 100
MATCH_CV_BATCH_SIZE = 25
MATCH_CV_TIME_BUDGET_S = 8.0
MATCH_SCORE_CACHE_TTL = 60 * 60 * 24  # 24h


def _truthy(value):
    return str(value).lower() in ("1", "true", "yes", "on")


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


def _passes_cv_match(
    match: dict,
    *,
    min_percent: int = GOOD_MATCH_PERCENT,
    min_terms: int = GOOD_MATCH_MIN_TERMS,
) -> bool:
    """Requirement-coverage gate for Annonser filters."""
    if not match:
        return False
    count = int(match.get("must_covered") or match.get("count") or 0)
    total = int(match.get("must_total") or match.get("total") or 0)
    if count <= 0:
        return False
    score = match.get("score")
    if score is not None:
        return int(score) >= min_percent or count >= min_terms
    # Low confidence / unknown band: still keep ads with any covered requirement
    # when the caller asked for a weak gate (match_cv / min_match=1).
    if min_percent <= 1:
        return True
    if total <= 0:
        return False
    percent = (count / total) * 100
    return percent >= min_percent or count >= min_terms


def _filter_jobs_by_cv_match(results, *, min_percent=GOOD_MATCH_PERCENT):
    return [
        job
        for job in results
        if job.get("match") and _passes_cv_match(job["match"], min_percent=min_percent)
    ]


def _dedupe_jobs_by_id(results: list) -> list:
    """Drop duplicate JobTech ads that share the same id (keeps first)."""
    seen: set[str] = set()
    unique: list = []
    for job in results or []:
        job_id = job.get("id") if isinstance(job, dict) else None
        if job_id is None:
            unique.append(job)
            continue
        key = str(job_id)
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)
    return unique


def _attach_cv_match(
    jobs: list[dict],
    *,
    evidence,
    skills,
    resume=None,
    profiles: bool = False,
    cache_key_prefix: str = "",
) -> None:
    from django.core.cache import cache

    from .requirements import score_all_profiles

    for job in jobs:
        title = job.get("title") or ""
        description = job.get("description") or ""
        posting = SimpleNamespace(title=title, description=description)
        cache_key = ""
        if cache_key_prefix and job.get("id"):
            cache_key = f"cvmatch:{cache_key_prefix}:{job['id']}"
            cached = cache.get(cache_key)
            if isinstance(cached, dict):
                job["match"] = dict(cached)
                if profiles and resume is not None and "profiles_scored" not in job["match"]:
                    try:
                        profiles_scored = score_all_profiles(resume, posting)
                        if profiles_scored:
                            job["match"]["profiles_scored"] = profiles_scored
                            job["match"]["best_profile"] = profiles_scored[0]
                    except Exception:
                        pass
                continue
        try:
            if evidence:
                job["match"] = match_evidence(evidence, posting)
            else:
                job["match"] = match_skills(skills or [], posting)
            if profiles and resume is not None:
                profiles_scored = score_all_profiles(resume, posting)
                if profiles_scored:
                    job["match"]["profiles_scored"] = profiles_scored
                    job["match"]["best_profile"] = profiles_scored[0]
            if cache_key:
                # Don't cache multi-profile payload (resume-specific detail).
                slim = {
                    k: v
                    for k, v in job["match"].items()
                    if k not in ("profiles_scored", "best_profile")
                }
                cache.set(cache_key, slim, MATCH_SCORE_CACHE_TTL)
        except Exception:
            logger.exception("CV match failed for job %s", job.get("id"))
            job["match"] = {
                "must_total": 0,
                "must_covered": 0,
                "merit_total": 0,
                "merit_covered": 0,
                "score": None,
                "band": "unknown",
                "confidence": "low",
                "covered": [],
                "gaps": [],
                "matched": [],
                "missing": [],
                "count": 0,
                "total": 0,
            }


def _match_sort_key(job: dict) -> tuple:
    match = job.get("match") or {}
    score = match.get("score")
    if score is not None:
        try:
            return (1, int(score))
        except (TypeError, ValueError):
            pass
    try:
        return (0, int(match.get("count") or 0))
    except (TypeError, ValueError):
        return (0, 0)


def _match_cache_prefix(*, evidence, skills, resume) -> str:
    import hashlib

    resume_stamp = ""
    if resume is not None:
        updated = getattr(resume, "updated_at", None)
        resume_stamp = updated.isoformat() if updated else str(getattr(resume, "pk", ""))
    raw = json.dumps(
        {
            "skills": skills or [],
            "evidence": [
                {"term": e.get("term"), "confirmed": e.get("confirmed")}
                for e in (evidence or [])
                if isinstance(e, dict)
            ],
            "resume": resume_stamp,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _search_jobs_matching_cv(
    *,
    evidence,
    skills,
    search_kwargs: dict,
    offset: int,
    limit: int,
    min_percent: int = GOOD_MATCH_PERCENT,
    resume=None,
) -> dict:
    """Scan a bounded JobTech window, score locally, paginate matches.

    Never raises for scoring failures — returns what we have with truncated=True.
    """
    import time

    matched: list[dict] = []
    scanned = 0
    upstream_total = 0
    truncated = False
    started = time.monotonic()
    cache_prefix = _match_cache_prefix(evidence=evidence, skills=skills, resume=resume)

    while scanned < MATCH_CV_SCAN_LIMIT:
        if time.monotonic() - started > MATCH_CV_TIME_BUDGET_S:
            truncated = True
            break
        batch = min(MATCH_CV_BATCH_SIZE, MATCH_CV_SCAN_LIMIT - scanned)
        try:
            data = _cached_jobtech_search(
                **{**search_kwargs, "offset": scanned, "limit": batch}
            )
        except JobTechError:
            truncated = True
            if scanned == 0:
                raise
            break
        upstream_total = int(data.get("total") or 0)
        results = list(data.get("results") or [])
        if not results:
            break
        _attach_cv_match(
            results,
            evidence=evidence,
            skills=skills,
            resume=None,
            profiles=False,
            cache_key_prefix=cache_prefix,
        )
        matched.extend(_filter_jobs_by_cv_match(results, min_percent=min_percent))
        scanned += len(results)
        if scanned >= upstream_total or len(results) < batch:
            break
    else:
        if scanned < upstream_total:
            truncated = True

    if scanned < upstream_total and scanned >= MATCH_CV_SCAN_LIMIT:
        truncated = True

    matched = _dedupe_jobs_by_id(matched)
    matched.sort(key=_match_sort_key, reverse=True)
    page = matched[max(0, offset) : max(0, offset) + max(1, limit)]
    try:
        _attach_cv_match(
            page,
            evidence=evidence,
            skills=skills,
            resume=resume,
            profiles=True,
            cache_key_prefix=cache_prefix,
        )
    except Exception:
        logger.exception("Failed to attach profile scores to match page")

    return {
        "results": page,
        "total": len(matched),
        "offset": offset,
        "limit": limit,
        "match_cv_filtered": True,
        "match_cv_scanned": scanned,
        "match_cv_upstream_total": upstream_total,
        "match_cv_threshold_percent": min_percent,
        "match_cv_min_terms": GOOD_MATCH_MIN_TERMS,
        "scanned": scanned,
        "truncated": truncated,
    }


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
            description=(
                "Only jobs that match the user's CV "
                f"(≥{GOOD_MATCH_PERCENT}% kravtäckning). "
                "Equivalent to min_match when min_match is unset."
            ),
        ),
        OpenApiParameter(
            "min_match",
            OpenApiTypes.INT,
            description="Minimum requirement-coverage score (0-100).",
        ),
        OpenApiParameter(
            "sort",
            OpenApiTypes.STR,
            description="Sort: match (coverage desc) or newest.",
        ),
        OpenApiParameter(
            "hide_blocked",
            OpenApiTypes.BOOL,
            description="Hide ads with hard formal blockers.",
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

    search_kwargs = {
        "q": params.get("q", ""),
        "regions": _parse_id_list(params, "region", "regions"),
        "municipalities": _parse_id_list(params, "municipality", "municipalities"),
        "fields": _parse_id_list(params, "field", "fields"),
        "groups": _parse_id_list(params, "group", "groups"),
        "remote": _truthy(params.get("remote", "")),
    }

    match_ctx = _resume_match_context(request.user)
    skills = match_ctx["cv_skills"] or None
    evidence = match_ctx["cv_evidence"] or None
    resume = match_ctx.get("resume")
    want_match_cv = _truthy(params.get("match_cv", ""))
    min_match = None
    if params.get("min_match") not in (None, ""):
        try:
            min_match = max(0, min(100, int(params.get("min_match"))))
        except ValueError as exc:
            raise ValidationError({"min_match": "Must be an integer 0-100."}) from exc
    if want_match_cv and min_match is None:
        min_match = 1
    sort_by = (params.get("sort") or "").strip().lower()
    hide_blocked = _truthy(params.get("hide_blocked", ""))

    if min_match is not None:
        if not skills:
            raise ValidationError(
                {
                    "detail": (
                        "Markera kompetenser i CV:t under Profil & CV för att "
                        "filtrera på matchning."
                    )
                }
            )
        try:
            data = _search_jobs_matching_cv(
                evidence=evidence,
                skills=skills,
                search_kwargs=search_kwargs,
                offset=offset,
                limit=limit,
                min_percent=max(min_match, 1),
                resume=resume,
            )
        except JobTechError:
            return Response(
                {"detail": "Kunde inte nå Platsbanken just nu. Försök igen strax."},
                status=drf_status.HTTP_502_BAD_GATEWAY,
            )
        except Exception:
            logger.exception("min_match search failed")
            # Prefer a usable empty payload over a hard 500 — UI can show truncated.
            data = {
                "results": [],
                "total": 0,
                "offset": offset,
                "limit": limit,
                "match_cv_filtered": True,
                "match_cv_scanned": 0,
                "scanned": 0,
                "truncated": True,
                "match_error": True,
                "detail": (
                    "Kunde inte beräkna CV-matchning just nu. "
                    "Prova utan matchningsfilter."
                ),
            }
        if hide_blocked:
            data["results"] = [
                job
                for job in data["results"]
                if not any(
                    f.get("ok") is False
                    for f in (job.get("match") or {}).get("formal") or []
                )
            ]
        return Response(data)

    try:
        data = _cached_jobtech_search(**search_kwargs, offset=offset, limit=limit)
    except JobTechError:
        return Response(
            {"detail": "Kunde inte nå Platsbanken just nu. Försök igen strax."},
            status=drf_status.HTTP_502_BAD_GATEWAY,
        )

    data["results"] = _dedupe_jobs_by_id(data.get("results") or [])

    if evidence or skills:
        _attach_cv_match(
            data["results"],
            evidence=evidence,
            skills=skills,
            resume=resume,
            profiles=True,
        )
        if hide_blocked:
            data["results"] = [
                job
                for job in data["results"]
                if not any(
                    f.get("ok") is False
                    for f in (job.get("match") or {}).get("formal") or []
                )
            ]
        if sort_by == "match":
            data["results"] = sorted(
                data["results"],
                key=_match_sort_key,
                reverse=True,
            )

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
