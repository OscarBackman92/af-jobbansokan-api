import { describe, expect, it } from "vitest";

import {
  buildIcsCalendar,
  todayActionToIcsEvent,
} from "./calendar.js";

describe("buildIcsCalendar", () => {
  it("emits a valid VCALENDAR wrapper", () => {
    const ics = buildIcsCalendar([
      {
        uid: "test-1@ansokt",
        date: "2026-07-01",
        summary: "Följ upp: Dev @ Acme",
        description: "Ring rekryteraren",
      },
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260701");
    expect(ics).toContain("SUMMARY:Följ upp: Dev @ Acme");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("escapes commas in descriptions", () => {
    const ics = buildIcsCalendar([
      {
        uid: "test-2@ansokt",
        date: "2026-07-01",
        summary: "Test",
        description: "Hej, världen",
      },
    ]);
    expect(ics).toContain("Hej\\, världen");
  });
});

describe("todayActionToIcsEvent", () => {
  it("maps application rows to calendar events", () => {
    const event = todayActionToIcsEvent({
      application: {
        id: 7,
        title: "Backend",
        company: "Acme",
        contact_name: "Anna",
        contact_info: "anna@example.com",
        ad_url: "https://example.com/job",
      },
      kind: "followup",
      date: "2026-08-15",
      label: "Uppföljning idag",
      calendarSummary: "Följ upp: Backend @ Acme",
    });
    expect(event.uid).toBe("jobbsoket-7-followup-2026-08-15@jobbsoket");
    expect(event.summary).toBe("Följ upp: Backend @ Acme");
    expect(event.description).toContain("Anna");
  });
});
