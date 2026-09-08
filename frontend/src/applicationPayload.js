import { externalUrl, normalizeAdUrl } from "./adUrl.js";

export const APPLICATION_FIELD_KEYS = [
  "company",
  "title",
  "location",
  "ad_url",
  "apply_url",
  "ad_description",
  "source_job_id",
  "occupation_label",
  "occupation_concept_id",
  "status",
  "source",
  "applied_at",
  "deadline",
  "salary_claim",
  "contact_name",
  "contact_info",
  "next_action_at",
  "notes",
];

function emptyToNull(value) {
  return value ? value : null;
}

export function normalizeApplicationPayload(form) {
  const body = {};
  for (const key of APPLICATION_FIELD_KEYS) {
    body[key] = form?.[key] ?? "";
  }
  body.ad_url = normalizeAdUrl(body.ad_url);
  body.apply_url = externalUrl(body.apply_url) || "";
  body.applied_at = emptyToNull(body.applied_at);
  body.next_action_at = emptyToNull(body.next_action_at);
  body.deadline = emptyToNull(body.deadline);
  body.salary_claim = String(body.salary_claim || "").trim();
  return body;
}

const SALARY_CLAIM_STATUSES = new Set([
  "applied",
  "screening",
  "interview",
  "forwarded",
  "offer",
  "accepted",
]);

export function salaryClaimRequired(status) {
  return SALARY_CLAIM_STATUSES.has(status);
}

export function changedApplicationFields(form, initialForm) {
  const next = normalizeApplicationPayload(form);
  const prev = normalizeApplicationPayload(initialForm);
  const patch = {};
  for (const key of APPLICATION_FIELD_KEYS) {
    if (next[key] !== prev[key]) patch[key] = next[key];
  }
  return patch;
}
