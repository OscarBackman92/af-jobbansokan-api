import { describe, expect, it } from "vitest";

import { countUpValue } from "./countUp.js";

describe("countUpValue", () => {
  it("starts at the previous value and lands on the target", () => {
    expect(countUpValue(0, 12, 0)).toBe(0);
    expect(countUpValue(0, 12, 1)).toBe(12);
  });

  it("clamps progress outside 0–1", () => {
    expect(countUpValue(4, 20, -0.5)).toBe(4);
    expect(countUpValue(4, 20, 2)).toBe(20);
  });

  it("eases out, so most of the distance is covered early", () => {
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50);
    expect(countUpValue(0, 100, 0.5)).toBeLessThan(100);
  });

  it("counts down when the target shrinks", () => {
    expect(countUpValue(9, 3, 0)).toBe(9);
    expect(countUpValue(9, 3, 1)).toBe(3);
  });

  it("returns whole numbers", () => {
    expect(Number.isInteger(countUpValue(0, 7, 0.37))).toBe(true);
  });
});
