"""KPI dashboard and sidebar helpers for the Unfold admin."""

from __future__ import annotations

from datetime import timedelta
from typing import TypedDict

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone

from .lifecycle import STAGE_AVSLUTAD
from .models import Activity, JobApplication, OperatorProfile, ReportPeriod

User = get_user_model()


class KpiCard(TypedDict):
    label: str
    value: int
    hint: str
    url: str
    warn: bool


class StatusRow(TypedDict):
    key: str
    label: str
    count: int
    pct: int


class RecentRow(TypedDict):
    title: str
    company: str
    owner: str
    status: str
    url: str


class WarnedRow(TypedDict):
    email: str
    operator_id: str
    warned_at: str
    url: str


def dashboard_callback(request: HttpRequest, context: dict) -> dict:
    """Attach live Jobbdjungeln stats to the Unfold admin index."""
    del request
    today = timezone.localdate()
    week_ago = timezone.now() - timedelta(days=7)

    users_total = User.objects.count()
    users_week = User.objects.filter(date_joined__gte=week_ago).count()
    unverified = EmailAddress.objects.filter(verified=False, primary=True).count()
    apps_total = JobApplication.objects.count()
    wishlist = JobApplication.objects.filter(
        status=JobApplication.STATUS_WISHLIST
    ).count()
    overdue = (
        JobApplication.objects.filter(next_action_at__lt=today)
        .exclude(stage=STAGE_AVSLUTAD)
        .count()
    )
    reports_open = ReportPeriod.objects.filter(submitted_at__isnull=True).count()
    activities_month = Activity.objects.filter(
        occurred_on__year=today.year, occurred_on__month=today.month
    ).count()

    status_map = dict(JobApplication.STATUS_CHOICES)
    raw_counts = {
        row["status"]: row["total"]
        for row in JobApplication.objects.values("status")
        .annotate(total=Count("id"))
        .order_by()
    }
    status_counts: list[StatusRow] = []
    for key, label in JobApplication.STATUS_CHOICES:
        count = int(raw_counts.get(key, 0))
        pct = int(round((count / apps_total) * 100)) if apps_total else 0
        status_counts.append({"key": key, "label": label, "count": count, "pct": pct})

    recent: list[RecentRow] = []
    recent_qs = JobApplication.objects.select_related("owner").order_by("-updated_at")[
        :8
    ]
    for app in recent_qs:
        owner = app.owner.email or app.owner.get_username()
        recent.append(
            {
                "title": app.title,
                "company": app.company,
                "owner": owner,
                "status": status_map.get(app.status, app.status),
                "url": reverse("admin:core_jobapplication_change", args=[app.pk]),
            }
        )

    warned: list[WarnedRow] = []
    warned_qs = (
        OperatorProfile.objects.filter(deletion_warned_at__isnull=False)
        .select_related("user")
        .order_by("-deletion_warned_at")[:8]
    )
    for profile in warned_qs:
        warned.append(
            {
                "email": profile.user.email or profile.user.get_username(),
                "operator_id": profile.operator_id,
                "warned_at": timezone.localtime(profile.deletion_warned_at).strftime(
                    "%Y-%m-%d"
                ),
                "url": reverse("admin:auth_user_change", args=[profile.user_id]),
            }
        )

    context.update(
        {
            "kpis": [
                {
                    "label": "Användare",
                    "value": users_total,
                    "hint": f"+{users_week} senaste 7 dagarna",
                    "url": reverse("admin:auth_user_changelist"),
                    "warn": False,
                },
                {
                    "label": "Ansökningar",
                    "value": apps_total,
                    "hint": f"{wishlist} sparade i bevakning",
                    "url": reverse("admin:core_jobapplication_changelist"),
                    "warn": False,
                },
                {
                    "label": "Försenad uppföljning",
                    "value": overdue,
                    "hint": "Nästa steg har passerat",
                    "url": (
                        reverse("admin:core_jobapplication_changelist")
                        + "?follow_up=overdue"
                    ),
                    "warn": overdue > 0,
                },
                {
                    "label": "Overifierade mejl",
                    "value": unverified,
                    "hint": "Primär adress inte bekräftad",
                    "url": reverse("admin:account_emailaddress_changelist")
                    + "?verified__exact=0",
                    "warn": unverified > 0,
                },
                {
                    "label": "Öppna AF-perioder",
                    "value": reports_open,
                    "hint": "Inte markerade som rapporterade",
                    "url": reverse("admin:core_reportperiod_changelist"),
                    "warn": False,
                },
                {
                    "label": "Aktiviteter denna månad",
                    "value": activities_month,
                    "hint": f"{today.strftime('%Y-%m')}",
                    "url": reverse("admin:core_activity_changelist"),
                    "warn": False,
                },
            ],
            "status_counts": status_counts,
            "recent_applications": recent,
            "warned_accounts": warned,
        }
    )
    return context


def user_badge(request: HttpRequest) -> str:
    del request
    return str(User.objects.count())


def application_badge(request: HttpRequest) -> str:
    del request
    return str(JobApplication.objects.count())
