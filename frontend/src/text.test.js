import { describe, expect, it } from "vitest";

import { foldDiacritics } from "./text.js";

describe("foldDiacritics", () => {
  it("folds Swedish letters for search", () => {
    expect(foldDiacritics("Järfälla")).toBe("jarfalla");
    expect(foldDiacritics("JARFALLA")).toBe("jarfalla");
    expect(foldDiacritics("Malmö")).toBe("malmo");
  });
});
