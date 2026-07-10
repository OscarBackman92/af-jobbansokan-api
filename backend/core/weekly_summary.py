"""Build the Monday morning weekly summary e-mail for one user."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import QuerySet

from .models import ApplicationEvent, JobApplication

INTERVIEW_STATUSES = {
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
}


@dataclass(frozen=True)
class WeekBounds:
    """Calendar weeks around the Monday the cron runs."""

    last_start: date
    last_end: date
    ahead_start: date
    ahead_end: date


@dataclass
class WeeklySummary:
    bounds: WeekBounds
    applied_last_week: list[JobApplication]
    interviews_last_week: list[ApplicationEvent]
    overdue: list[JobApplication]
    upcoming_actions: list[JobApplication]
    deadlines: list[JobApplication]
    upcoming_interviews: list[JobApplication]
    active_count: int
    offer_count: int


def week_bounds(reference: date) -> WeekBounds:
    """Return last Mon–Sun and the coming Mon–Sun from *reference*."""
    monday = reference - timedelta(days=reference.weekday())
    return WeekBounds(
        last_start=monday - timedelta(days=7),
        last_end=monday - timedelta(days=1),
        ahead_start=monday,
        ahead_end=monday + timedelta(days=6),
    )


def _in_range(value: date | None, start: date, end: date) -> bool:
    return value is not None and start <= value <= end


def build_weekly_summary(
    applications: QuerySet[JobApplication],
    *,
    today: date,
    events: QuerySet[ApplicationEvent] | None = None,
) -> WeeklySummary:
    bounds = week_bounds(today)
    apps = list(applications)
    app_ids = [app.pk for app in apps]

    if events is None:
        events = ApplicationEvent.objects.filter(application_id__in=app_ids)
    event_list = list(events)

    applied_last_week = [
        app
        for app in apps
        if app.status != JobApplication.STATUS_WISHLIST
        and _in_range(app.applied_at, bounds.last_start, bounds.last_end)
    ]

    interviews_last_week = [
        event
        for event in event_list
        if event.status in INTERVIEW_STATUSES
        and _in_range(event.occurred_at, bounds.last_start, bounds.last_end)
    ]

    active = [app for app in apps if app.status in JobApplication.ACTIVE_STATUSES]

    overdue = sorted(
        [
            app
            for app in active
            if app.next_action_at is not None and app.next_action_at < today
        ],
        key=lambda app: app.next_action_at,
    )

    upcoming_actions = sorted(
        [
            app
            for app in active
            if _in_range(app.next_action_at, today, bounds.ahead_end)
        ],
        key=lambda app: app.next_action_at,
    )

    deadlines = sorted(
        [
            app
            for app in active
            if app.status == JobApplication.STATUS_WISHLIST
            and _in_range(app.deadline, today, bounds.ahead_end)
        ],
        key=lambda app: app.deadline,
    )

    upcoming_interviews = sorted(
        [
            app
            for app in active
            if app.status in INTERVIEW_STATUSES
            and _in_range(app.next_action_at, today, bounds.ahead_end)
        ],
        key=lambda app: app.next_action_at,
    )

    offer_count = sum(
        1
        for app in apps
        if app.status in {JobApplication.STATUS_OFFER, JobApplication.STATUS_ACCEPTED}
    )

    return WeeklySummary(
        bounds=bounds,
        applied_last_week=applied_last_week,
        interviews_last_week=interviews_last_week,
        overdue=overdue,
        upcoming_actions=upcoming_actions,
        deadlines=deadlines,
        upcoming_interviews=upcoming_interviews,
        active_count=len(active),
        offer_count=offer_count,
    )


def summary_has_content(summary: WeeklySummary, *, digest_count: int) -> bool:
    if digest_count:
        return True
    return bool(
        summary.applied_last_week
        or summary.interviews_last_week
        or summary.overdue
        or summary.upcoming_actions
        or summary.deadlines
        or summary.upcoming_interviews
        or summary.offer_count
    )


def _fmt_date(value: date) -> str:
    return value.strftime("%Y-%m-%d")


def _line_app(app: JobApplication, *, suffix: str = "") -> str:
    text = f"- {app.title} @ {app.company}"
    if suffix:
        text += f" ({suffix})"
    return text


def format_weekly_summary_email(
    summary: WeeklySummary,
    *,
    digests: list[tuple[str, list[dict]]],
    frontend_url: str,
) -> tuple[str, str]:
    """Return (subject, plain-text body)."""
    b = summary.bounds
    lines = [
        "Hej!",
        "",
        (
            f"Din veckosammanfattning från Jobbsöket "
            f"({_fmt_date(b.last_start)}–{_fmt_date(b.last_end)}):"
        ),
        "",
    ]

    last_week_lines: list[str] = []
    if summary.applied_last_week:
        count = len(summary.applied_last_week)
        word = "ansökan skickad" if count == 1 else "ansökningar skickade"
        last_week_lines.append(f"• {count} {word}")
    if summary.interviews_last_week:
        count = len(summary.interviews_last_week)
        word = "intervjuhändelse" if count == 1 else "intervjuhändelser"
        last_week_lines.append(f"• {count} {word}")
    if last_week_lines:
        lines.append("FÖRRA VECKAN")
        lines.extend(last_week_lines)
        lines.append("")

    action_lines: list[str] = []
    for app in summary.overdue:
        when = _fmt_date(app.next_action_at)
        action_lines.append(_line_app(app, suffix=f"försenad uppföljning {when}"))
    for app in summary.upcoming_actions:
        if app in summary.overdue:
            continue
        action_lines.append(
            _line_app(app, suffix=f"nästa steg {_fmt_date(app.next_action_at)}")
        )
    for app in summary.deadlines:
        action_lines.append(
            _line_app(app, suffix=f"deadline {_fmt_date(app.deadline)}")
        )
    for app in summary.upcoming_interviews:
        if app in summary.overdue or app in summary.upcoming_actions:
            continue
        when = _fmt_date(app.next_action_at) if app.next_action_at else "datum saknas"
        action_lines.append(_line_app(app, suffix=f"intervju {when}"))

    if action_lines:
        lines.append(f"ATT GÖRA ({_fmt_date(b.ahead_start)}–{_fmt_date(b.ahead_end)})")
        lines.extend(action_lines)
        lines.append("")

    if summary.active_count or summary.offer_count:
        lines.append("ÖVERSIKT")
        lines.append(f"• {summary.active_count} pågående ansökningar")
        if summary.offer_count:
            lines.append(
                f"• {summary.offer_count} "
                f"{'erbjudande' if summary.offer_count == 1 else 'erbjudanden'}"
            )
        lines.append("")

    digest_lines: list[str] = []
    for label, jobs in digests:
        if not jobs:
            continue
        digest_lines.append(f"• {label} — {len(jobs)} nya annonser:")
        for job in jobs:
            digest_lines.append(f"  - {job['title']} @ {job['company_name']}")

    if digest_lines:
        lines.append("NYA ANNONSER (sparade sökningar)")
        lines.extend(digest_lines)
        lines.append("")

    if frontend_url:
        lines.append(f"Öppna appen: {frontend_url.rstrip('/')}")
    else:
        lines.append("Öppna Jobbsöket i webbläsaren för att uppdatera dina ansökningar.")
    lines.append("")

    subject = "Jobbsöket — din veckosammanfattning"
    return subject, "\n".join(lines)
