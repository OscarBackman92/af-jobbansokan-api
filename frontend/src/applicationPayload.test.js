import { describe, expect, it } from "vitest";

import {
  changedApplicationFields,
  normalizeApplicationPayload,
  salaryClaimRequired,
} from "./applicationPayload.js";

const base = {
  company: "Acme",
  title: "Dev",
  location: "Stockholm",
  ad_url: "",
  apply_url: "",
  ad_description: "Krav: Python",
  source_job_id: "1",
  occupation_label: "Utvecklare",
  occupation_concept_id: "abc",
  status: "applied",
  source: "platsbanken",
  applied_at: "2026-08-01",
  deadline: "",
  contact_name: "",
  contact_info: "",
  next_action_at: "",
  notes: "",
  salary_claim: "45 000 kr/mån",
};

describe("applicationPayload", () => {
  it("does not include unchanged occupation on a status-only edit", () => {
    const form = { ...base, status: "interview" };
    const patch = changedApplicationFields(form, base);
    expect(patch).toEqual({ status: "interview" });
    expect(patch).not.toHaveProperty("occupation_concept_id");
  });

  it("omits empty occupation so a list-row save cannot wipe the server value", () => {
    const listRow = { ...base, occupation_label: "", occupation_concept_id: "" };
    const patch = changedApplicationFields(
      { ...listRow, status: "interview" },
      listRow
    );
    expect(patch).toEqual({ status: "interview" });
  });

  it("normalizes blank dates to null", () => {
    const body = normalizeApplicationPayload(base);
    expect(body.deadline).toBeNull();
    expect(body.applied_at).toBe("2026-08-01");
    expect(body.salary_claim).toBe("45 000 kr/mån");
  });

  it("requires a salary claim once the job is applied", () => {
    expect(salaryClaimRequired("applied")).toBe(true);
    expect(salaryClaimRequired("interview")).toBe(true);
    expect(salaryClaimRequired("wishlist")).toBe(false);
    expect(salaryClaimRequired("withdrawn")).toBe(false);
  });
});
