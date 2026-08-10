"""Dashboard aggregates for GET /api/v1/dashboard/.

One ORM query (or aggregate) per response block — no Python loops over
full application tables. Small values_list slices are used only for medians.
"""

from __future__ import annotations

from datetime import timedelta
from statistics import median

from django.db.models import (
    Count,
    DateField,
    DurationField,
    ExpressionWrapper,
    F,
    OuterRef,
    Q,
    Subquery,
)
from django.db.models.functions import TruncMonth
from django.utils import timezone

from .models import ApplicationEvent, JobApplication

SILENCE_FOLLOW_UP_DAYS = 7
DIALOG_STATUSES = [
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
]
OFFER_STATUSES = [
    JobApplication.STATUS_OFFER,
    JobApplication.STATUS_ACCEPTED,
]
AWAITING_STATUSES = [
    JobApplication.STATUS_APPLIED,
    JobApplication.STATUS_SCREENING,
]
CLOSED_STATUSES = [
    JobApplication.STATUS_REJECTED,
    JobApplication.STATUS_NO_RESPONSE,
    JobApplication.STATUS_WITHDRAWN,
]
RESPONSE_STATUSES = [
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
    JobApplication.STATUS_OFFER,
    JobApplication.STATUS_ACCEPTED,
    JobApplication.STATUS_REJECTED,
    JobApplication.STATUS_NO_RESPONSE,
    JobApplication.STATUS_WITHDRAWN,
]


def _active_qs(user):
    return JobApplication.objects.filter(owner=user, archived_at__isnull=True)


def _median_days(deltas):
    values = []
    for delta in deltas:
        if delta is None:
            continue
        if hasattr(delta, "days"):
            values.append(delta.days)
        else:
            try:
                values.append(int(delta))
            except (TypeError, ValueError):
                continue
    if not values:
        return None
    return int(round(median(values)))


def build_dashboard(user) -> dict:
    today = timezone.localdate()
    week_end = today + timedelta(days=7)
    seven_ago = today - timedelta(days=7)
    base = _active_qs(user)

    return {
        "kpis": _kpis(base, today, week_end),
        "funnel": _funnel(base),
        "next_actions": _next_actions(base, today, week_end),
        "monthly": _monthly(base, today),
        "outcomes": _outcomes(base, today),
        "response_by_match": _response_by_match(),
        "top_companies": _top_companies(base),
        "waiting_age": _waiting_age(base, today),
        "pace": _pace(base, user, today, seven_ago),
    }


def _kpis(base, today, week_end):
    wishlist = base.filter(status=JobApplication.STATUS_WISHLIST)
    applied_side = base.exclude(status=JobApplication.STATUS_WISHLIST)
    silence_cutoff = today - timedelta(days=SILENCE_FOLLOW_UP_DAYS)
    auto_no_deadline = Q(deadline__isnull=True, apply_by_is_auto=True)

    active_wishlist = wishlist.exclude(intent=JobApplication.INTENT_PAUSED)
    to_apply = active_wishlist.filter(
        apply_by__gte=today, apply_by__lte=week_end
    ).count()
    urgent = (
        active_wishlist.exclude(auto_no_deadline)
        .filter(apply_by__gte=today, apply_by__lte=week_end)
        .count()
    )
    follow_up = applied_side.filter(
        Q(next_action_at__lte=today)
        | Q(
            status__in=AWAITING_STATUSES,
            next_action_at__isnull=True,
            applied_at__lte=silence_cutoff,
        )
    ).count()

    return {
        "to_apply": to_apply,
        "urgent": urgent,
        "follow_up": follow_up,
        "saved_total": wishlist.count(),
        "active_applications": applied_side.exclude(status__in=CLOSED_STATUSES).count(),
        "in_dialog": applied_side.filter(status__in=DIALOG_STATUSES).count(),
        "offers": applied_side.filter(status__in=OFFER_STATUSES).count(),
    }


def _funnel(base):
    applied_side = base.exclude(status=JobApplication.STATUS_WISHLIST)
    return {
        "tracked": base.count(),
        "applied": applied_side.count(),
        "responded": applied_side.filter(
            Q(status__in=RESPONSE_STATUSES) | Q(events__status__in=RESPONSE_STATUSES)
        )
        .distinct()
        .count(),
        "in_dialog": base.filter(status__in=DIALOG_STATUSES).count(),
        "interview": base.filter(
            Q(status=JobApplication.STATUS_INTERVIEW)
            | Q(events__status=JobApplication.STATUS_INTERVIEW)
        )
        .distinct()
        .count(),
        "offer": base.filter(status__in=OFFER_STATUSES).count(),
    }


def _next_actions(base, today, week_end):
    open_rows = base.exclude(
        status__in=[*CLOSED_STATUSES, JobApplication.STATUS_ACCEPTED]
    )
    followups = list(
        open_rows.filter(next_action_at__isnull=False, next_action_at__lte=week_end)
        .order_by("next_action_at")
        .values("id", "title", "company", "status", "next_action_at")[:5]
    )
    rows = [
        {
            "id": row["id"],
            "kind": "followup",
            "date": str(row["next_action_at"]),
            "title": row["title"],
            "company": row["company"],
            "status": row["status"],
            "label": (
                "Uppföljning idag"
                if row["next_action_at"] == today
                else f"Nästa steg {row['next_action_at']}"
            ),
        }
        for row in followups
    ]
    if len(rows) < 5:
        taken = {row["id"] for row in rows}
        deadlines = (
            base.filter(status=JobApplication.STATUS_WISHLIST)
            .exclude(intent=JobApplication.INTENT_PAUSED)
            .filter(apply_by__isnull=False, apply_by__lte=week_end)
            .exclude(id__in=taken)
            .order_by("apply_by")
            .values("id", "title", "company", "status", "apply_by")[: 5 - len(rows)]
        )
        for row in deadlines:
            rows.append(
                {
                    "id": row["id"],
                    "kind": "deadline",
                    "date": str(row["apply_by"]),
                    "title": row["title"],
                    "company": row["company"],
                    "status": row["status"],
                    "label": f"Sök senast {row['apply_by']}",
                }
            )
    rows.sort(key=lambda row: row["date"])
    return rows[:5]


def _monthly(base, today):
    start_year, start_month = today.year, today.month
    keys = []
    year, month = start_year, start_month
    for _ in range(6):
        keys.append(f"{year}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    keys.reverse()
    earliest = keys[0] + "-01"

    counts = {}
    for row in (
        base.exclude(applied_at__isnull=True)
        .filter(applied_at__gte=earliest)
        .annotate(month=TruncMonth("applied_at"))
        .values("month")
        .annotate(count=Count("id"))
    ):
        if not row["month"]:
            continue
        key = row["month"].strftime("%Y-%m")
        counts[key] = row["count"]

    return [{"month": key, "count": counts.get(key, 0)} for key in keys]


def _outcomes(base, today):
    applied_side = base.exclude(status=JobApplication.STATUS_WISHLIST)
    silence_cutoff = today - timedelta(days=SILENCE_FOLLOW_UP_DAYS)
    return {
        "rejected": applied_side.filter(status=JobApplication.STATUS_REJECTED).count(),
        "no_response": applied_side.filter(
            status=JobApplication.STATUS_NO_RESPONSE
        ).count(),
        "waiting": applied_side.filter(
            status__in=AWAITING_STATUSES, applied_at__lte=silence_cutoff
        ).count(),
        "fresh": applied_side.filter(
            status__in=AWAITING_STATUSES,
            applied_at__gt=silence_cutoff,
        ).count(),
    }


def _response_by_match():
    # CV match is computed in the list serializer, not stored — leave nulls
    # so the UI can render <span class="tag">beräknas</span>.
    return [
        {"bucket": "has_match", "applied": None, "responded": None},
        {"bucket": "no_match", "applied": None, "responded": None},
    ]


def _top_companies(base):
    return list(
        base.exclude(status=JobApplication.STATUS_WISHLIST)
        .values("company")
        .annotate(count=Count("id"))
        .order_by("-count", "company")[:6]
    )


def _waiting_age(base, today):
    waiting = base.filter(status__in=AWAITING_STATUSES, applied_at__isnull=False)
    return waiting.aggregate(
        d0_6=Count("id", filter=Q(applied_at__gte=today - timedelta(days=6))),
        d7_10=Count(
            "id",
            filter=Q(
                applied_at__lte=today - timedelta(days=7),
                applied_at__gte=today - timedelta(days=10),
            ),
        ),
        d11_14=Count(
            "id",
            filter=Q(
                applied_at__lte=today - timedelta(days=11),
                applied_at__gte=today - timedelta(days=14),
            ),
        ),
        d15_plus=Count("id", filter=Q(applied_at__lte=today - timedelta(days=15))),
    )


def _pace(base, user, today, seven_ago):
    week_start = timezone.now() - timedelta(days=7)
    applied_7d = base.filter(applied_at__gte=seven_ago, applied_at__lte=today).count()
    saved_7d = base.filter(created_at__gte=week_start).count()
    save_apply_ratio = round(applied_7d / saved_7d, 2) if saved_7d > 0 else None

    # Duration between created_at (as date) and applied_at — values_list only.
    created_dates = list(
        base.filter(applied_at__isnull=False).values_list("created_at", "applied_at")[
            :500
        ]
    )
    saved_to_applied = [
        (applied - timezone.localtime(created).date()).days
        for created, applied in created_dates
        if created and applied
    ]
    median_days_saved_to_applied = (
        int(round(median(saved_to_applied))) if saved_to_applied else None
    )

    first_response = (
        ApplicationEvent.objects.filter(
            application_id=OuterRef("pk"),
            status__in=RESPONSE_STATUSES,
        )
        .exclude(status=JobApplication.STATUS_APPLIED)
        .order_by("occurred_at")
        .values("occurred_at")[:1]
    )
    response_deltas = list(
        base.filter(applied_at__isnull=False)
        .annotate(first_response_at=Subquery(first_response, output_field=DateField()))
        .exclude(first_response_at__isnull=True)
        .annotate(
            delta=ExpressionWrapper(
                F("first_response_at") - F("applied_at"),
                output_field=DurationField(),
            )
        )
        .values_list("delta", flat=True)[:500]
    )
    median_days_to_response = _median_days(response_deltas)

    followups_logged = ApplicationEvent.objects.filter(
        application__owner=user,
        occurred_at__gte=seven_ago,
        note__icontains="följ",
    ).count()

    return {
        "applied_7d": applied_7d,
        "saved_7d": saved_7d,
        "save_apply_ratio": save_apply_ratio,
        "median_days_saved_to_applied": median_days_saved_to_applied,
        "median_days_to_response": median_days_to_response,
        "followups_logged": followups_logged,
    }
