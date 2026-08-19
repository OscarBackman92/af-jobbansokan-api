"""Shared KPI definitions for dashboard, insights, and the applications board.

Every view that talks about "fått svar", "nyligen sökta" or "väntar" should
import these sets instead of inventing a parallel threshold.
"""

from __future__ import annotations

from .models import JobApplication

# Days without a first reply before an applied row is "väntar för länge".
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
# Still waiting for the employer to reply at all.
AWAITING_STATUSES = [
    JobApplication.STATUS_APPLIED,
]
CLOSED_STATUSES = [
    JobApplication.STATUS_REJECTED,
    JobApplication.STATUS_NO_RESPONSE,
    JobApplication.STATUS_WITHDRAWN,
]
# Employer actually replied (including rejection). Not "no reply" / withdrawn.
GOT_REPLY_STATUSES = [
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
    JobApplication.STATUS_OFFER,
    JobApplication.STATUS_ACCEPTED,
    JobApplication.STATUS_REJECTED,
]
POSITIVE_RESPONSE = {
    JobApplication.STATUS_SCREENING,
    JobApplication.STATUS_INTERVIEW,
    JobApplication.STATUS_FORWARDED,
    JobApplication.STATUS_OFFER,
    JobApplication.STATUS_ACCEPTED,
}
