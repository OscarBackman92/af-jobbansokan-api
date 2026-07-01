function escapeIcs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsDate(dateString) {
  return dateString.replace(/-/g, "");
}

function formatIcsStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function eventLines({ uid, date, summary, description }) {
  const stamp = formatIcsStamp();
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(date)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : null,
    "END:VEVENT",
  ].filter(Boolean);
}

/** Build a single .ics file with one or more all-day events. */
export function buildIcsCalendar(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ansokt//Job Tracker//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    lines.push(...eventLines(event));
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function todayActionToIcsEvent(item) {
  const app = item.application;
  const description = [
    item.label,
    app.contact_name && `Kontakt: ${app.contact_name}`,
    app.contact_info && app.contact_info,
    app.ad_url && `Annons: ${app.ad_url}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    uid: `ansokt-${app.id}-${item.kind}-${item.date}@ansokt`,
    date: item.date,
    summary: item.calendarSummary,
    description,
  };
}

export function downloadTodayActionsIcs(items) {
  if (!items.length) return;
  const content = buildIcsCalendar(items.map(todayActionToIcsEvent));
  downloadIcs("ansokt-idag.ics", content);
}

export function downloadSingleActionIcs(item) {
  const content = buildIcsCalendar([todayActionToIcsEvent(item)]);
  const slug = item.application.company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 24);
  downloadIcs(`ansokt-${slug || "paminnelse"}.ics`, content);
}
