import { describe, expect, it } from "vitest";

import {
  buildTodayActions,
  compareApplicationsByApplied,
  daysUntil,
  hasDeadlineSoon,
  isFollowUp,
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
