import { describe, expect, it } from "vitest";

import { countSummary } from "./plural.js";

describe("countSummary", () => {
  it("uses singular for one saved job", () => {
    expect(countSummary(1, "sparat", "sparade")).toBe("1 sparat");
  });

  it("uses plural otherwise", () => {
    expect(countSummary(0, "sparat", "sparade")).toBe("0 sparade");
    expect(countSummary(2, "sparat", "sparade")).toBe("2 sparade");
  });
});
