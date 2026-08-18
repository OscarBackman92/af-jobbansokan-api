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
    Max,
    OuterRef,
    Q,
    Subquery,
)
from django.db.models.functions import Coalesce, TruncMonth
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
POSITIVE_RESPONSE = {
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
    JobApplication.STATUS_OFFER,
    JobApplication.STATUS_ACCEPTED,
}


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
    with_snapshot = base.exclude(match_scored_at__isnull=True).count()

    return {
        "kpis": _kpis(base, today, week_end),
        "funnel": _funnel(base),
        "next_actions": _next_actions(base, today, week_end),
        "monthly": _monthly(base, today),
        "outcomes": _outcomes(base, today),
        "response_by_match": _response_by_match(base),
        "top_companies": _top_companies(base),
        "waiting_age": _waiting_age(base, today),
        "pace": _pace(base, user, today, seven_ago),
        "match_scope": {
            "applications": base.count(),
            "with_snapshot": with_snapshot,
            "applied_with_score": (
                base.exclude(status=JobApplication.STATUS_WISHLIST)
                .exclude(match_score__isnull=True)
                .count()
            ),
        },
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
    follow_up = (
        applied_side.filter(status=JobApplication.STATUS_APPLIED)
        .annotate(_last_event=Max("events__occurred_at"))
        .annotate(last_act=Coalesce("_last_event", "applied_at"))
        .filter(last_act__lte=silence_cutoff)
        .count()
    )

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
    """Cumulative 'reached at least this stage' funnel — monotone decreasing."""
    applied_side = base.exclude(status=JobApplication.STATUS_WISHLIST)
    tracked = base.count()
    applied = applied_side.count()

    reached_response = (
        applied_side.filter(
            Q(status__in=RESPONSE_STATUSES) | Q(events__status__in=RESPONSE_STATUSES)
        )
        .distinct()
        .count()
    )
    # Merge dialog + interview into one cumulative "reached dialog-or-beyond".
    reached_dialog = (
        applied_side.filter(
            Q(status__in=[*DIALOG_STATUSES, *OFFER_STATUSES])
            | Q(events__status__in=[*DIALOG_STATUSES, *OFFER_STATUSES])
        )
        .distinct()
        .count()
    )
    reached_interview = (
        applied_side.filter(
            Q(status__in=[JobApplication.STATUS_INTERVIEW, *OFFER_STATUSES])
            | Q(
                events__status__in=[
                    JobApplication.STATUS_INTERVIEW,
                    *OFFER_STATUSES,
                ]
            )
        )
        .distinct()
        .count()
    )
    reached_offer = applied_side.filter(status__in=OFFER_STATUSES).count()

    # Enforce monotonicity (never grow down the funnel).
    responded = min(reached_response, applied)
    in_dialog = min(reached_dialog, responded)
    interview = min(reached_interview, in_dialog)
    offer = min(reached_offer, interview)

    return {
        "tracked": tracked,
        "applied": applied,
        "responded": responded,
        "in_dialog": in_dialog,
        "interview": interview,
        "offer": offer,
    }


def _next_actions(base, today, week_end):
    open_rows = base.exclude(
        status__in=[*CLOSED_STATUSES, JobApplication.STATUS_ACCEPTED]
    )
    followups = list(
        open_rows.filter(
            next_action_at__isnull=False,
            next_action_at__gte=today,
            next_action_at__lte=week_end,
        )
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
            .filter(apply_by__isnull=False, apply_by__gte=today, apply_by__lte=week_end)
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
    """Partition of sökta rows into outcome buckets (sum ≤ applied count)."""
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
        "applied_total": applied_side.count(),
    }


def _response_by_match(base):
    """Response rates from stored match snapshots (not live recompute)."""
    scored = base.exclude(status=JobApplication.STATUS_WISHLIST).exclude(
        match_score__isnull=True
    )
    buckets = [
        ("has_match", Q(match_score__gte=60)),
        ("no_match", Q(match_score__lt=60)),
    ]
    rows = []
    for bucket, filt in buckets:
        qs = scored.filter(filt)
        applied = qs.count()
        responded = qs.filter(status__in=POSITIVE_RESPONSE).count()
        entry = {"bucket": bucket, "applied": applied, "responded": responded}
        if applied >= 5:
            entry["rate"] = round(responded / applied, 3)
        else:
            entry["rate"] = None
            entry["insufficient_data"] = True
        rows.append(entry)
    return rows


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
    # One rolling ~7-day window for all pace metrics on this card.
    week_start = timezone.now() - timedelta(days=7)
    applied_7d = base.filter(applied_at__gte=seven_ago).count()
    saved_7d = base.filter(
        status=JobApplication.STATUS_WISHLIST, created_at__gte=week_start
    ).count()

    # Same cohort: of rows *created* in the window, how many later became applied.
    created_in_window = base.filter(created_at__gte=week_start)
    created_count = created_in_window.count()
    created_then_applied = created_in_window.exclude(
        status=JobApplication.STATUS_WISHLIST
    ).count()
    if created_count >= 5:
        save_apply_ratio = min(1.0, round(created_then_applied / created_count, 2))
    else:
        save_apply_ratio = None

    # Only rows saved *before* they were applied (positive lag).
    created_dates = list(
        base.filter(applied_at__isnull=False).values_list("created_at", "applied_at")[
            :500
        ]
    )
    saved_to_applied = []
    for created, applied in created_dates:
        if not created or not applied:
            continue
        created_day = timezone.localtime(created).date()
        if applied < created_day:
            continue
        saved_to_applied.append((applied - created_day).days)
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
        "save_apply_cohort": created_count,
        "median_days_saved_to_applied": median_days_saved_to_applied,
        "median_days_saved_to_applied_n": len(saved_to_applied),
        "median_days_to_response": median_days_to_response,
        "followups_logged": followups_logged,
    }
