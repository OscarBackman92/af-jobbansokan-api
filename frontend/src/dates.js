import { CLOSED_STATUSES } from "./statuses.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

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

    if (nextIn !== null && nextIn <= 0) {
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

    if (
      deadlineIn !== null &&
      deadlineIn <= 7 &&
      application.status === "wishlist"
    ) {
      items.push({
        application,
        kind: "deadline",
        date: application.deadline,
        sortKey: deadlineIn + (nextIn !== null && nextIn <= 0 ? 50 : 200),
        label:
          deadlineIn < 0
            ? `Deadline passerad (${application.deadline})`
            : deadlineIn === 0
              ? "Sista ansökningsdag idag"
              : `Sista ansökningsdag om ${deadlineIn} ${
                  deadlineIn === 1 ? "dag" : "dagar"
                }`,
        calendarSummary: `Deadline: ${application.title} @ ${application.company}`,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.date.localeCompare(b.date);
  });
}
