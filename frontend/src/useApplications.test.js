import { describe, expect, it } from "vitest";

import { mergeApplicationRow } from "./useApplications.js";

describe("mergeApplicationRow", () => {
  it("keeps match when the mutation response is lean", () => {
    const prev = {
      id: 1,
      title: "Dev",
      match: { score: 80 },
      last_activity_at: "2026-06-01",
    };
    const merged = mergeApplicationRow(prev, {
      id: 1,
      title: "Backend",
      last_activity_at: "2026-06-10",
    });
    expect(merged.title).toBe("Backend");
    expect(merged.match).toEqual({ score: 80 });
    expect(merged.last_activity_at).toBe("2026-06-10");
  });

  it("does not rewind last_activity_at", () => {
    const merged = mergeApplicationRow(
      { id: 1, last_activity_at: "2026-06-10" },
      { id: 1, last_activity_at: "2026-06-01" }
    );
    expect(merged.last_activity_at).toBe("2026-06-10");
  });
});
