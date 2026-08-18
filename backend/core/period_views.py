"""HTTP endpoints for AF report periods."""

from __future__ import annotations

from django.db import transaction
from django.http import Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .periods import (
    get_or_create_period,
    list_periods,
    parse_period_key,
    reopen_period,
    serialize_period,
    submit_period,
)
from .permissions import IsAuthenticatedUser


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
