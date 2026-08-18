"""Job application lifecycle: stage/outcome, allowed transitions, derived flags.

Mapped onto the existing JobApplication.status field so Sparade and
Ansökningar stay one table with two filters. Status remains the public
API value; stage and outcome are the canonical axes.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

# Spec proposed 14; the product already uses 7 for "väntar för länge".
WAIT_THRESHOLD_DAYS = int(getattr(settings, "WAIT_THRESHOLD_DAYS", 7))
STALE_DAYS = int(getattr(settings, "STALE_NO_RESPONSE_DAYS", 45))

STAGE_BEVAKAD = "bevakad"
STAGE_SOKT = "sokt"
STAGE_KONTAKT = "kontakt"
STAGE_INTERVJU = "intervju"
STAGE_ERBJUDANDE = "erbjudande"
STAGE_AVSLUTAD = "avslutad"

STAGE_CHOICES = [
    (STAGE_BEVAKAD, "Bevakad"),
    (STAGE_SOKT, "Sökt"),
    (STAGE_KONTAKT, "Kontakt"),
    (STAGE_INTERVJU, "Intervju"),
    (STAGE_ERBJUDANDE, "Erbjudande"),
    (STAGE_AVSLUTAD, "Avslutad"),
]

OUTCOME_AVSLAG = "avslag"
OUTCOME_INGET_SVAR = "inget_svar"
OUTCOME_ATERKALLAD = "aterkallad"
OUTCOME_TACKADE_JA = "tackade_ja"
OUTCOME_TACKADE_NEJ = "tackade_nej"
OUTCOME_TJANSTEN_TILLSATT = "tjansten_tillsatt"

OUTCOME_CHOICES = [
    (OUTCOME_AVSLAG, "Avslag"),
    (OUTCOME_INGET_SVAR, "Inget svar"),
    (OUTCOME_ATERKALLAD, "Återkallad"),
    (OUTCOME_TACKADE_JA, "Tackade ja"),
    (OUTCOME_TACKADE_NEJ, "Tackade nej"),
    (OUTCOME_TJANSTEN_TILLSATT, "Tjänsten tillsatt"),
]

# Existing JobApplication.status → (stage, outcome).
STATUS_TO_STAGE_OUTCOME = {
    "wishlist": (STAGE_BEVAKAD, ""),
    "applied": (STAGE_SOKT, ""),
    "screening": (STAGE_KONTAKT, ""),
    "forwarded": (STAGE_KONTAKT, ""),
    "interview": (STAGE_INTERVJU, ""),
    "offer": (STAGE_ERBJUDANDE, ""),
    "accepted": (STAGE_AVSLUTAD, OUTCOME_TACKADE_JA),
    "rejected": (STAGE_AVSLUTAD, OUTCOME_AVSLAG),
    "no_response": (STAGE_AVSLUTAD, OUTCOME_INGET_SVAR),
    "withdrawn": (STAGE_AVSLUTAD, OUTCOME_ATERKALLAD),
}

ALLOWED_STAGE_TRANSITIONS = {
    STAGE_BEVAKAD: {STAGE_SOKT, STAGE_AVSLUTAD},
    STAGE_SOKT: {STAGE_KONTAKT, STAGE_INTERVJU, STAGE_ERBJUDANDE, STAGE_AVSLUTAD},
    STAGE_KONTAKT: {STAGE_INTERVJU, STAGE_ERBJUDANDE, STAGE_AVSLUTAD},
    STAGE_INTERVJU: {STAGE_ERBJUDANDE, STAGE_AVSLUTAD, STAGE_KONTAKT},
    STAGE_ERBJUDANDE: {STAGE_AVSLUTAD},
    STAGE_AVSLUTAD: {STAGE_SOKT, STAGE_KONTAKT, STAGE_INTERVJU, STAGE_ERBJUDANDE},
}

_COMPANY_FORM_RE = re.compile(
    r"\b(aktiebolag|handelsbolag|kommanditbolag|ekonomisk\s+förening|"
    r"ek\.?\s*för\.?|co|ab|kb|hb)\b\.?",
    re.IGNORECASE,
)


def employer_key(name: str) -> str:
    text = unicodedata.normalize("NFKC", name or "")
    text = text.replace("&", " ")
    text = _COMPANY_FORM_RE.sub(" ", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip().casefold()


def stage_for_status(status: str) -> str:
    stage, _outcome = STATUS_TO_STAGE_OUTCOME.get(status, (STAGE_SOKT, ""))
    return stage


def outcome_for_status(status: str) -> str:
    _stage, outcome = STATUS_TO_STAGE_OUTCOME.get(status, (STAGE_SOKT, ""))
    return outcome


def allowed_next_statuses(status: str) -> list[str]:
    """Statuses the UI may offer from `status`, excluding the current one."""
    current_stage = stage_for_status(status)
    allowed_stages = ALLOWED_STAGE_TRANSITIONS.get(current_stage, set())
    next_ids = []
    for other, (stage, _outcome) in STATUS_TO_STAGE_OUTCOME.items():
        if other == status:
            continue
        if stage == current_stage or stage in allowed_stages:
            next_ids.append(other)
    return next_ids


def assert_transition_allowed(from_status: str, to_status: str) -> None:
    if from_status == to_status:
        return
    if to_status not in allowed_next_statuses(from_status):
        raise ValidationError(
            {
                "status": (
                    f"Övergång från {from_status} till {to_status} är inte tillåten."
                )
            }
        )


def waiting_days(application, *, today: date | None = None) -> int | None:
    if stage_for_status(application.status) != STAGE_SOKT:
        return None
    last = getattr(application, "_last_event_at", None)
    if last is None:
        last = getattr(application, "last_activity_at", None)
    if last is None:
        last = application.applied_at
    if last is None:
        return None
    if hasattr(last, "date"):
        last = last.date()
    today = today or timezone.localdate()
    return (today - last).days


def is_overdue(application, *, today: date | None = None) -> bool:
    days = waiting_days(application, today=today)
    return days is not None and days >= WAIT_THRESHOLD_DAYS


def is_stale(application, *, today: date | None = None) -> bool:
    days = waiting_days(application, today=today)
    return days is not None and days > STALE_DAYS


def followup_overdue(application, *, today: date | None = None) -> bool:
    if stage_for_status(application.status) == STAGE_AVSLUTAD:
        return False
    next_step = application.next_action_at
    if next_step is None:
        return False
    today = today or timezone.localdate()
    return next_step < today


def is_unreported(application) -> bool:
    return (
        application.applied_at is not None
        and getattr(application, "reported_in_id", None) is None
        and not getattr(application, "report_excluded", False)
    )
