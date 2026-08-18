import { describe, expect, it } from "vitest";

import {
  appliedBucket,
  applyByFor,
  buildTodayActions,
  collectMonthOptions,
  compareApplicationsByApplied,
  compareByDateThenMatch,
  daysUntil,
  daysUntilApplyBy,
  daysWaiting,
  encodeMonthFilter,
  formatMonthLabel,
  groupTodayActions,
  hasDeadlineSoon,
  isFollowUp,
  matchesMonthFilter,
  parseMonthFilter,
  savedBucket,
  SILENCE_FOLLOW_UP_DAYS,
} from "./dates.js";

describe("daysUntil", () => {
  it("returns whole days until a date", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const target = new Date(today);
    target.setDate(target.getDate() + 3);
    const iso = target.toISOString().slice(0, 10);
    expect(daysUntil(iso)).toBe(3);
  });
});

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("isFollowUp", () => {
  it("flags overdue next_action_at", () => {
    expect(
      isFollowUp({
        status: "applied",
        next_action_at: daysAgo(1),
      })
    ).toBe(true);
  });

  it("flags applied rows silent for a week", () => {
    expect(
      isFollowUp({
        status: "applied",
        applied_at: daysAgo(SILENCE_FOLLOW_UP_DAYS),
      })
    ).toBe(true);
  });

  it("does not flag fresh applications", () => {
    expect(
      isFollowUp({
        status: "applied",
        applied_at: daysAgo(2),
      })
    ).toBe(false);
  });

  it("does not treat wishlist deadlines as follow-ups", () => {
    expect(
      isFollowUp({
        status: "wishlist",
        deadline: daysFromNow(3),
      })
    ).toBe(false);
  });
});

describe("hasDeadlineSoon", () => {
  it("only counts wishlist deadlines within 7 days", () => {
    expect(
      hasDeadlineSoon({
        status: "wishlist",
        deadline: daysFromNow(5),
      })
    ).toBe(true);
    expect(
      hasDeadlineSoon({
        status: "applied",
        deadline: daysFromNow(5),
      })
    ).toBe(false);
  });

  it("excludes overdue from the upcoming window by default", () => {
    expect(
      hasDeadlineSoon({ status: "wishlist", deadline: daysAgo(2) })
    ).toBe(false);
    expect(
      hasDeadlineSoon(
        { status: "wishlist", deadline: daysAgo(2) },
        { includeOverdue: true }
      )
    ).toBe(true);
  });
});

describe("compareApplicationsByApplied", () => {
  it("sorts newest applied_at first and undated last", () => {
    const rows = [
      { id: 1, applied_at: "2026-07-05", updated_at: "2026-07-05T00:00:00Z" },
      { id: 2, applied_at: null, updated_at: "2026-07-26T00:00:00Z" },
      { id: 3, applied_at: "2026-07-25", updated_at: "2026-07-25T00:00:00Z" },
    ];
    const sorted = [...rows].sort(compareApplicationsByApplied);
    expect(sorted.map((r) => r.id)).toEqual([3, 1, 2]);
  });
});

describe("month filter helpers", () => {
  it("encodes and parses applied/saved month filters", () => {
    expect(encodeMonthFilter("applied", "2026-03")).toBe("applied:2026-03");
    expect(encodeMonthFilter("saved", "2026-01")).toBe("saved:2026-01");
    expect(encodeMonthFilter("applied", "")).toBe("");
    expect(parseMonthFilter("applied:2026-03")).toEqual({
      field: "applied",
      monthKey: "2026-03",
    });
    expect(parseMonthFilter("nope")).toBeNull();
  });

  it("formats Swedish month labels", () => {
    expect(formatMonthLabel("2026-03")).toBe("mars 2026");
    expect(formatMonthLabel("2025-12")).toBe("december 2025");
  });

  it("matches applied and saved months independently", () => {
    const row = {
      applied_at: "2026-03-12",
      created_at: "2026-01-05T10:00:00Z",
    };
    expect(matchesMonthFilter(row, "")).toBe(true);
    expect(matchesMonthFilter(row, "applied:2026-03")).toBe(true);
    expect(matchesMonthFilter(row, "applied:2026-02")).toBe(false);
    expect(matchesMonthFilter(row, "saved:2026-01")).toBe(true);
    expect(matchesMonthFilter(row, "saved:2026-03")).toBe(false);
  });

  it("collects unique months newest first", () => {
    const options = collectMonthOptions(
      [
        { applied_at: "2026-01-02", created_at: "2025-12-01T00:00:00Z" },
        { applied_at: "2026-03-10", created_at: "2026-02-01T00:00:00Z" },
        { applied_at: null, created_at: "2026-02-15T00:00:00Z" },
      ],
      "applied"
    );
    expect(options.map((o) => o.key)).toEqual(["2026-03", "2026-01"]);
    expect(options[0].label).toBe("mars 2026");
  });
});

describe("buildTodayActions", () => {
  it("lists overdue follow-ups before upcoming deadlines", () => {
    const yesterday = daysAgo(1);
    const tomorrow = daysFromNow(1);

    const items = buildTodayActions([
      {
        id: 1,
        status: "applied",
        title: "Late",
        company: "A",
        next_action_at: yesterday,
      },
      {
        id: 2,
        status: "wishlist",
        title: "Soon",
        company: "B",
        deadline: tomorrow,
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].application.id).toBe(1);
    expect(items[0].kind).toBe("followup");
    expect(items[1].kind).toBe("deadline");
    expect(items[1].calendarSummary).toMatch(/^Ansök:/);
  });

  it("lists overdue wishlist deadlines before upcoming ones", () => {
    const items = buildTodayActions([
      {
        id: 10,
        status: "wishlist",
        title: "Soon",
        company: "B",
        deadline: daysFromNow(3),
      },
      {
        id: 11,
        status: "wishlist",
        title: "Late",
        company: "C",
        deadline: daysAgo(2),
      },
    ]);
    expect(items.map((item) => item.application.id)).toEqual([11, 10]);
  });

  it("lists silence-based follow-ups for applied rows", () => {
    const items = buildTodayActions([
      {
        id: 4,
        status: "applied",
        title: "Quiet",
        company: "D",
        applied_at: daysAgo(14),
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("followup");
    expect(items[0].label).toMatch(/Inget svar/);
  });

  it("ignores closed applications", () => {
    const items = buildTodayActions([
      {
        id: 3,
        status: "rejected",
        title: "Done",
        company: "C",
        next_action_at: "2020-01-01",
      },
    ]);
    expect(items).toHaveLength(0);
  });
});

describe("groupTodayActions", () => {
  it("keeps wishlist deadlines out of the follow-up group", () => {
    const items = buildTodayActions([
      {
        id: 1,
        status: "applied",
        title: "Quiet",
        company: "A",
        applied_at: daysAgo(14),
      },
      {
        id: 2,
        status: "wishlist",
        title: "Save",
        company: "B",
        deadline: daysFromNow(2),
      },
    ]);
    const { followUps, applyBeforeDeadline } = groupTodayActions(items);
    expect(followUps).toHaveLength(1);
    expect(followUps[0].kind).toBe("followup");
    expect(applyBeforeDeadline).toHaveLength(1);
    expect(applyBeforeDeadline[0].kind).toBe("deadline");
  });
});

describe("applyByFor / daysUntilApplyBy", () => {
  it("prefers apply_by, then deadline, then created_at + 14", () => {
    expect(
      applyByFor({ apply_by: "2026-08-20", deadline: "2026-08-10" })
    ).toBe("2026-08-20");
    expect(applyByFor({ deadline: "2026-08-10" })).toBe("2026-08-10");
    expect(
      applyByFor({ created_at: "2026-08-01T10:00:00Z" })
    ).toBe("2026-08-15");
    expect(applyByFor({})).toBeNull();
  });

  it("reports days until the resolved apply-by date", () => {
    expect(daysUntilApplyBy({ apply_by: daysFromNow(4) })).toBe(4);
    expect(daysUntilApplyBy({})).toBeNull();
  });
});

describe("savedBucket", () => {
  it("classifies paused and expired first", () => {
    expect(
      savedBucket({
        intent: "paused",
        deadline: daysFromNow(2),
        apply_by_is_auto: false,
      })
    ).toBe("paused");
    expect(
      savedBucket({
        deadline: daysAgo(1),
        apply_by: daysAgo(1),
        apply_by_is_auto: false,
      })
    ).toBe("expired");
  });

  it("puts auto-planned rows without deadline in no_deadline", () => {
    expect(
      savedBucket({
        created_at: daysAgo(10) + "T10:00:00Z",
        apply_by: daysFromNow(4),
        apply_by_is_auto: true,
      })
    ).toBe("no_deadline");
  });

  it("splits real deadlines into urgent and month", () => {
    expect(
      savedBucket({
        deadline: daysFromNow(3),
        apply_by: daysFromNow(3),
        apply_by_is_auto: false,
      })
    ).toBe("urgent");
    expect(
      savedBucket({
        deadline: daysFromNow(14),
        apply_by: daysFromNow(14),
        apply_by_is_auto: false,
      })
    ).toBe("month");
  });

  it("treats manual apply_by without deadline as planned dates", () => {
    expect(
      savedBucket({
        apply_by: daysFromNow(2),
        apply_by_is_auto: false,
      })
    ).toBe("urgent");
  });
});

describe("appliedBucket / daysWaiting", () => {
  it("computes days waiting from last activity", () => {
    expect(daysWaiting({ applied_at: daysAgo(5) })).toBe(5);
    expect(daysWaiting({})).toBeNull();
  });

  it("routes closed, offer, and dialog before waiting age", () => {
    expect(appliedBucket({ status: "rejected" })).toBe("closed");
    expect(appliedBucket({ status: "accepted" })).toBe("offer");
    expect(appliedBucket({ status: "interview" })).toBe("dialog");
  });

  it("splits applied rows into late and fresh by silence window", () => {
    expect(
      appliedBucket({
        status: "applied",
        applied_at: daysAgo(SILENCE_FOLLOW_UP_DAYS),
      })
    ).toBe("late");
    expect(
      appliedBucket({
        status: "applied",
        applied_at: daysAgo(2),
      })
    ).toBe("fresh");
  });
});

describe("compareByDateThenMatch", () => {
  it("sorts earlier date first, then higher match ratio", () => {
    const rows = [
      {
        id: 1,
        apply_by: "2026-08-20",
        match: { count: 8, total: 10 },
      },
      {
        id: 2,
        apply_by: "2026-08-10",
        match: { count: 1, total: 10 },
      },
      {
        id: 3,
        apply_by: "2026-08-10",
        match: { count: 9, total: 10 },
      },
    ];
    const sorted = [...rows].sort(compareByDateThenMatch);
    expect(sorted.map((r) => r.id)).toEqual([3, 2, 1]);
  });
});
