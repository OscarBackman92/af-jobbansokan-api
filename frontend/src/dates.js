import { CLOSED_STATUSES } from "./statuses.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days without employer contact before an applied/screening row needs follow-up. */
export const SILENCE_FOLLOW_UP_DAYS = 7;

/** Statuses where we are waiting on the employer, not chasing a deadline. */
export const AWAITING_RESPONSE_STATUSES = ["applied", "screening"];

/** Whole days from today (local midnight) until the given ISO date. */
export function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateString) - today) / DAY_MS);
}

export function isClosed(application) {
  return CLOSED_STATUSES.includes(application.status);
}

/** Best available date for "last signal" without shipping the full timeline. */
export function lastActivityDate(application) {
  if (application.last_activity_at) return application.last_activity_at;
  if (application.applied_at) return application.applied_at;
  if (application.created_at) return application.created_at.slice(0, 10);
  return null;
}

/**
 * Needs follow-up: overdue next-step, or applied/screening with silence.
 * Deadlines on wishlist rows are NOT follow-ups — use hasDeadlineSoon.
 */
export function isFollowUp(application) {
  if (isClosed(application)) return false;

  const nextIn = daysUntil(application.next_action_at);
  if (nextIn !== null && nextIn <= 0) return true;

  if (!AWAITING_RESPONSE_STATUSES.includes(application.status)) return false;
  const activity = lastActivityDate(application);
  const until = daysUntil(activity);
  if (until === null) return false;
  return -until >= SILENCE_FOLLOW_UP_DAYS;
}

/**
 * Upcoming (or today) application deadline on a saved row.
 * Overdue deadlines remain actionable in Idag via buildTodayActions; the
 * board KPI/chip "inom 7 dagar" excludes them by default.
 */
export function hasDeadlineSoon(application, { includeOverdue = false } = {}) {
  if (isClosed(application)) return false;
  if (application.status !== "wishlist") return false;
  const deadlineIn = daysUntil(application.deadline);
  if (deadlineIn === null) return false;
  if (deadlineIn > 7) return false;
  if (!includeOverdue && deadlineIn < 0) return false;
  return true;
}

/**
 * Sort key for board sections: newest applied_at first, undated last,
 * then newest updated_at as tiebreaker.
 */
export function compareApplicationsByApplied(a, b) {
  const aDate = a.applied_at || "";
  const bDate = b.applied_at || "";
  if (aDate !== bDate) {
    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.localeCompare(aDate);
  }
  return (b.updated_at || "").localeCompare(a.updated_at || "");
}

/**
 * Actionable items for the "Idag" panel — follow-ups, deadlines, upcoming steps.
 * Sorted: overdue first, then today, then soonest date.
 */
export function buildTodayActions(applications) {
  const items = [];

  for (const application of applications) {
    if (isClosed(application)) continue;

    const nextIn = daysUntil(application.next_action_at);
    const deadlineIn = daysUntil(application.deadline);
    let listedScheduledFollowUp = false;

    if (nextIn !== null && nextIn <= 0) {
      listedScheduledFollowUp = true;
      items.push({
        application,
        kind: "followup",
        date: application.next_action_at,
        sortKey: nextIn,
        label:
          nextIn < 0
            ? `Försenad uppföljning (${application.next_action_at})`
            : "Uppföljning idag",
        calendarSummary: `Följ upp: ${application.title} @ ${application.company}`,
      });
    } else if (nextIn !== null && nextIn > 0 && nextIn <= 7) {
      items.push({
        application,
        kind: "upcoming",
        date: application.next_action_at,
        sortKey: nextIn + 100,
        label: `Nästa steg om ${nextIn} ${nextIn === 1 ? "dag" : "dagar"}`,
        calendarSummary: `Nästa steg: ${application.title} @ ${application.company}`,
      });
    }

    // Employer silence — only when there is no scheduled next-step already listed.
    if (
      !listedScheduledFollowUp &&
      AWAITING_RESPONSE_STATUSES.includes(application.status)
    ) {
      const activity = lastActivityDate(application);
      const until = daysUntil(activity);
      if (until !== null && -until >= SILENCE_FOLLOW_UP_DAYS) {
        const silentDays = -until;
        items.push({
          application,
          kind: "followup",
          date: activity,
          sortKey: -silentDays,
          label: `Inget svar på ${silentDays} dagar`,
          calendarSummary: `Följ upp: ${application.title} @ ${application.company}`,
        });
      }
    }

    if (
      deadlineIn !== null &&
      deadlineIn <= 7 &&
      application.status === "wishlist"
    ) {
      items.push({
        application,
        kind: "deadline",
        date: application.deadline,
        // Overdue first within the apply-before-deadline group.
        sortKey: deadlineIn,
        label:
          deadlineIn < 0
            ? `Deadline passerad (${application.deadline})`
            : deadlineIn === 0
              ? "Sista ansökningsdag idag"
              : `Sista ansökningsdag om ${deadlineIn} ${
                  deadlineIn === 1 ? "dag" : "dagar"
                }`,
        calendarSummary: `Ansök: ${application.title} @ ${application.company}`,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.date.localeCompare(b.date);
  });
}

/** Split Idag items into follow-up vs apply-before-deadline groups. */
export function groupTodayActions(items) {
  const followUps = [];
  const applyBeforeDeadline = [];
  for (const item of items) {
    if (item.kind === "deadline") applyBeforeDeadline.push(item);
    else followUps.push(item);
  }
  return { followUps, applyBeforeDeadline };
}
