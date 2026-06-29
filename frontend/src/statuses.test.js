import { describe, expect, it } from "vitest";

import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  STATUS_LABELS,
  STATUSES,
} from "./statuses.js";

describe("statuses", () => {
  it("maps every status id to a Swedish label", () => {
    for (const status of STATUSES) {
      expect(STATUS_LABELS[status.id]).toBe(status.label);
    }
  });

  it("keeps active and closed statuses disjoint", () => {
    const overlap = ACTIVE_STATUSES.filter((status) =>
      CLOSED_STATUSES.includes(status)
    );
    expect(overlap).toEqual([]);
  });

  it("covers all defined statuses in active or closed groups", () => {
    const grouped = new Set([...ACTIVE_STATUSES, ...CLOSED_STATUSES]);
    expect(grouped.size).toBe(STATUSES.length);
  });
});
