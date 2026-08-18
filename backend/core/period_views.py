"""HTTP endpoints for AF report periods and side activities."""

from __future__ import annotations

from django.db import transaction
from django.http import Http404, HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Activity, ApplicationEvent, JobApplication
from .periods import (
    export_csv_bytes,
    get_or_create_period,
    list_periods,
    parse_period_key,
    reopen_period,
    serialize_period,
    submit_period,
)
from .permissions import IsAuthenticatedUser
from .serializers import ActivitySerializer


def _period_or_404(user, key: str):
    parsed = parse_period_key(key)
    if parsed is None:
        raise Http404
    year, month = parsed
    return get_or_create_period(user, year, month)


class PeriodListView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response({"results": list_periods(request.user)})


class PeriodDetailView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, key: str):
        period = _period_or_404(request.user, key)
        return Response(serialize_period(period, detail=True))


class PeriodSubmitView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, key: str):
        period = _period_or_404(request.user, key)
        with transaction.atomic():
            submit_period(period)
            period.refresh_from_db()
        return Response(serialize_period(period, detail=True))


class PeriodReopenView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, key: str):
        period = _period_or_404(request.user, key)
        reopen_period(period)
        period.refresh_from_db()
        return Response(serialize_period(period, detail=True))


class PeriodExportView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.STR})
    def get(self, request, key: str):
        period = _period_or_404(request.user, key)
        payload = export_csv_bytes(period)
        response = HttpResponse(payload, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            "attachment; filename="
            f'"aktivitetsrapport-{period.year}-{period.month:02d}.csv"'
        )
        return response


class PeriodExcludeView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, key: str):
        period = _period_or_404(request.user, key)
        kind = request.data.get("kind")
        try:
            object_id = int(request.data.get("id"))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"id": "Required integer id."}) from exc
        excluded = str(request.data.get("excluded", True)).lower() not in {
            "0",
            "false",
            "no",
        }
        note = str(request.data.get("note") or "")[:255]
        if kind == "job":
            row = JobApplication.objects.filter(
                owner=request.user, pk=object_id
            ).first()
            if row is None:
                raise ValidationError({"id": "Jobbet hittades inte."})
            row.report_excluded = excluded
            row.report_note = note if excluded else ""
            row.save(update_fields=["report_excluded", "report_note", "updated_at"])
        elif kind == "activity":
            row = Activity.objects.filter(user=request.user, pk=object_id).first()
            if row is None:
                raise ValidationError({"id": "Aktiviteten hittades inte."})
            row.report_excluded = excluded
            row.report_note = note if excluded else ""
            row.save(update_fields=["report_excluded", "report_note"])
        elif kind == "event":
            row = ApplicationEvent.objects.filter(
                application__owner=request.user, pk=object_id
            ).first()
            if row is None:
                raise ValidationError({"id": "Händelsen hittades inte."})
            row.report_excluded = excluded
            row.save(update_fields=["report_excluded"])
        else:
            raise ValidationError({"kind": "Must be job, activity or event."})
        return Response(serialize_period(period, detail=True))


class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Activity.objects.none()
        return Activity.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        job = serializer.validated_data.get("job")
        if job and job.owner_id != self.request.user.id:
            raise ValidationError({"job": "Jobbet tillhör inte dig."})
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        job = serializer.validated_data.get("job")
        if job and job.owner_id != self.request.user.id:
            raise ValidationError({"job": "Jobbet tillhör inte dig."})
        serializer.save()
