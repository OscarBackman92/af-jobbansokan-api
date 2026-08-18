"""AF report periods: calendar month + derived status. Never store status."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from django.utils import timezone

from .models import Activity, ApplicationEvent, JobApplication, ReportPeriod

STATUS_PAGAENDE = "pagaende"
STATUS_KLAR = "klar"
STATUS_RAPPORTERAD = "rapporterad"
STATUS_FORSENAD = "forsenad"

MONTH_NAMES_SV = (
    "",
    "januari",
    "februari",
    "mars",
    "april",
    "maj",
    "juni",
    "juli",
    "augusti",
    "september",
    "oktober",
    "november",
    "december",
)


def add_months(year: int, month: int, delta: int = 1) -> tuple[int, int]:
    total = year * 12 + (month - 1) + delta
    return total // 12, total % 12 + 1


def window(year: int, month: int) -> tuple[date, date]:
    """Reporting window for a period: 1st–14th of the following month."""
    next_year, next_month = add_months(year, month, 1)
    opens = date(next_year, next_month, 1)
    closes = date(next_year, next_month, 14)
    return opens, closes


def status_for(period, today: date | None = None) -> str:
    if getattr(period, "submitted_at", None):
        return STATUS_RAPPORTERAD
    today = today or timezone.localdate()
    opens, closes = window(period.year, period.month)
    if today < opens:
        return STATUS_PAGAENDE
    if today <= closes:
        return STATUS_KLAR
    return STATUS_FORSENAD


def period_key(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def parse_period_key(key: str) -> tuple[int, int] | None:
    parts = str(key or "").split("-")
    if len(parts) != 2:
        return None
    try:
        year, month = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if month < 1 or month > 12 or year < 2000 or year > 2100:
        return None
    return year, month


def month_name(month: int) -> str:
    if month < 1 or month > 12:
        return ""
    return MONTH_NAMES_SV[month]


def month_heading(month: int) -> str:
    name = month_name(month)
    return name[:1].upper() + name[1:] if name else ""


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    last = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def _sought_qs(user, year: int, month: int):
    start, end = _month_bounds(year, month)
    return JobApplication.objects.filter(
        owner=user,
        archived_at__isnull=True,
        applied_at__gte=start,
        applied_at__lte=end,
    )


def _activity_qs(user, year: int, month: int):
    start, end = _month_bounds(year, month)
    return Activity.objects.filter(
        user=user, occurred_on__gte=start, occurred_on__lte=end
    )


def _reportable_event_qs(user, year: int, month: int):
    start, end = _month_bounds(year, month)
    return ApplicationEvent.objects.filter(
        application__owner=user,
        is_reportable=True,
        occurred_at__gte=start,
        occurred_at__lte=end,
    )


def ensure_periods(user, *, today: date | None = None) -> list[ReportPeriod]:
    """Create ReportPeriod rows for months with applications plus this month."""
    today = today or timezone.localdate()
    months = set(
        JobApplication.objects.filter(owner=user, applied_at__isnull=False)
        .values_list("applied_at__year", "applied_at__month")
        .distinct()
    )
    months.add((today.year, today.month))
    periods = []
    for year, month in sorted(months):
        period, _created = ReportPeriod.objects.get_or_create(
            user=user, year=year, month=month
        )
        periods.append(period)
    return periods


def banner_text(summary: dict) -> str | None:
    status = summary["status"]
    if status not in {STATUS_KLAR, STATUS_FORSENAD}:
        return None
    heading = month_heading(summary["month"])
    jobs = summary["job_count"]
    activities = summary["activity_count"]
    deadline = f"14 {month_name(summary['window_closes'].month)}"
    if status == STATUS_KLAR:
        return (
            f"{heading} är klar att rapportera — {jobs} sökta jobb "
            f"och {activities} aktiviteter. Lämna in senast {deadline}."
        )
    return (
        f"{heading} är försenad att rapportera — {jobs} sökta jobb "
        f"och {activities} aktiviteter. Fönstret stängde {deadline}."
    )


def serialize_period(
    period, *, today: date | None = None, detail: bool = False
) -> dict:
    today = today or timezone.localdate()
    opens, closes = window(period.year, period.month)
    jobs = _sought_qs(period.user, period.year, period.month)
    activities = _activity_qs(period.user, period.year, period.month)
    events = _reportable_event_qs(period.user, period.year, period.month)
    job_count = jobs.count()
    activity_count = activities.count() + events.count()
    payload = {
        "key": period_key(period.year, period.month),
        "year": period.year,
        "month": period.month,
        "label": f"{month_heading(period.month)} {period.year}",
        "status": status_for(period, today),
        "window_opens": opens.isoformat(),
        "window_closes": closes.isoformat(),
        "submitted_at": (
            period.submitted_at.isoformat() if period.submitted_at else None
        ),
        "job_count": job_count,
        "activity_count": activity_count,
        "note": period.note,
    }
    payload["banner"] = banner_text(
        {
            **payload,
            "window_closes": closes,
        }
    )
    if not detail:
        return payload

    payload["jobs"] = list(
        jobs.order_by("applied_at", "id").values(
            "id",
            "applied_at",
            "company",
            "title",
            "location",
            "occupation_label",
            "occupation_concept_id",
            "ad_url",
            "status",
            "report_excluded",
            "report_note",
        )
    )
    payload["activities"] = list(
        activities.order_by("occurred_on", "id").values(
            "id",
            "type",
            "occurred_on",
            "title",
            "organisation",
            "note",
            "job_id",
        )
    )
    payload["events"] = list(
        events.order_by("occurred_at", "id").values(
            "id",
            "occurred_at",
            "note",
            "event_type",
            "application_id",
            "is_reportable",
        )
    )
    return payload


def list_periods(user, *, today: date | None = None) -> list[dict]:
    today = today or timezone.localdate()
    periods = ensure_periods(user, today=today)
    return [serialize_period(period, today=today) for period in periods]


def submit_period(period, *, today: date | None = None) -> ReportPeriod:
    """Idempotent: stamp submitted_at and link unreported rows in the month."""
    today = today or timezone.localdate()
    if period.submitted_at is None:
        period.submitted_at = timezone.now()
        period.save(update_fields=["submitted_at"])
    start, end = _month_bounds(period.year, period.month)
    JobApplication.objects.filter(
        owner=period.user,
        applied_at__gte=start,
        applied_at__lte=end,
        reported_in__isnull=True,
        report_excluded=False,
    ).update(reported_in=period)
    ApplicationEvent.objects.filter(
        application__owner=period.user,
        occurred_at__gte=start,
        occurred_at__lte=end,
        is_reportable=True,
        reported_in__isnull=True,
    ).update(reported_in=period)
    Activity.objects.filter(
        user=period.user,
        occurred_on__gte=start,
        occurred_on__lte=end,
        reported_in__isnull=True,
    ).update(reported_in=period)
    return period


def reopen_period(period) -> ReportPeriod:
    period.submitted_at = None
    period.save(update_fields=["submitted_at"])
    return period


def get_or_create_period(user, year: int, month: int) -> ReportPeriod:
    period, _created = ReportPeriod.objects.get_or_create(
        user=user, year=year, month=month
    )
    return period
