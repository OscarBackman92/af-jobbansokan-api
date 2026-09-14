import { describe, expect, it } from "vitest";

import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  STATUS_LABELS,
  STATUSES,
  allowedNextStatuses,
  commonAllowedStatuses,
  salaryClaimMissingOnApply,
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

  it("does not offer Sparad once a job is sought", () => {
    expect(allowedNextStatuses("applied")).not.toContain("wishlist");
    expect(allowedNextStatuses("interview")).not.toContain("wishlist");
  });

  it("requires an outcome to leave an open stage for closed", () => {
    expect(allowedNextStatuses("applied")).toEqual(
      expect.arrayContaining(["rejected", "no_response", "withdrawn", "accepted"])
    );
  });

  it("intersects allowed next statuses for a bulk selection", () => {
    const common = commonAllowedStatuses([
      { status: "applied" },
      { status: "screening" },
    ]);
    const ids = common.map((entry) => entry.id);
    expect(ids).toEqual(
      expect.arrayContaining(["interview", "rejected", "no_response"])
    );
    expect(ids).not.toContain("applied");
    expect(ids).not.toContain("wishlist");
  });

  it("requires a salary claim when leaving Sparad for a sought status", () => {
    expect(salaryClaimMissingOnApply("applied", "", "wishlist")).toBe(true);
    expect(salaryClaimMissingOnApply("applied", "40 000", "wishlist")).toBe(
      false
    );
    expect(salaryClaimMissingOnApply("interview", "", "applied")).toBe(false);
    expect(salaryClaimMissingOnApply("rejected", "", "wishlist")).toBe(false);
  });
});
