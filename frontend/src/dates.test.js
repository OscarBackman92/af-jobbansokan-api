import { describe, expect, it } from "vitest";

import { buildTodayActions, daysUntil } from "./dates.js";

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

describe("buildTodayActions", () => {
  it("lists overdue follow-ups before upcoming deadlines", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const items = buildTodayActions([
      {
        id: 1,
        status: "applied",
        title: "Late",
        company: "A",
        next_action_at: yesterday.toISOString().slice(0, 10),
      },
      {
        id: 2,
        status: "wishlist",
        title: "Soon",
        company: "B",
        deadline: tomorrow.toISOString().slice(0, 10),
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].application.id).toBe(1);
    expect(items[0].kind).toBe("followup");
    expect(items[1].kind).toBe("deadline");
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
