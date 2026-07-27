import { describe, expect, it } from "vitest";

import { localISODate } from "./localDate.js";

describe("localISODate", () => {
  it("uses local calendar date, not UTC", () => {
    const sample = new Date(2026, 6, 27, 0, 30, 0); // Jul 27 local, still Jul 26 UTC in SE summer
    expect(localISODate(sample)).toBe("2026-07-27");
  });
});
