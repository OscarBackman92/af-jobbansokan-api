import type { ApplicationStatus } from "./types/app.js";

type StatusEntry = {
  id: ApplicationStatus;
  label: string;
};

/** Mirror of JobApplication.STATUS_CHOICES — ids must match OpenAPI StatusEnum. */
export const STATUSES: StatusEntry[] = [
  { id: "wishlist", label: "Sparad" },
  { id: "applied", label: "Ansökt" },
  { id: "screening", label: "Telefonintervju" },
  { id: "interview", label: "Intervju" },
  { id: "forwarded", label: "Skickad vidare" },
  { id: "offer", label: "Erbjudande" },
  { id: "accepted", label: "Accepterat" },
  { id: "rejected", label: "Avslag" },
  { id: "no_response", label: "Inget svar" },
  { id: "withdrawn", label: "Återkallad" },
];

export const ALL_STATUS_IDS: ApplicationStatus[] = STATUSES.map((status) => status.id);

// Pipeline stages; the rest live in the archive.
export const ACTIVE_STATUSES: ApplicationStatus[] = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "forwarded",
  "offer",
];

export const CLOSED_STATUSES: ApplicationStatus[] = [
  "accepted",
  "rejected",
  "no_response",
  "withdrawn",
];

/** Mirror of backend core.lifecycle.allowed_next_statuses. */
const STAGE_BY_STATUS: Record<ApplicationStatus, string> = {
  wishlist: "bevakad",
  applied: "sokt",
  screening: "kontakt",
  forwarded: "kontakt",
  interview: "intervju",
  offer: "erbjudande",
  accepted: "avslutad",
  rejected: "avslutad",
  no_response: "avslutad",
  withdrawn: "avslutad",
};

const ALLOWED_STAGE_TRANSITIONS: Record<string, string[]> = {
  bevakad: ["sokt", "avslutad"],
  sokt: ["kontakt", "intervju", "erbjudande", "avslutad"],
  kontakt: ["intervju", "erbjudande", "avslutad"],
  intervju: ["erbjudande", "avslutad", "kontakt"],
  erbjudande: ["avslutad"],
  avslutad: ["sokt", "kontakt", "intervju", "erbjudande"],
};

export function allowedNextStatuses(status: ApplicationStatus): ApplicationStatus[] {
  const currentStage = STAGE_BY_STATUS[status];
  const allowedStages = new Set(ALLOWED_STAGE_TRANSITIONS[currentStage] || []);
  return ALL_STATUS_IDS.filter((id) => {
    if (id === status) return false;
    const stage = STAGE_BY_STATUS[id];
    return stage === currentStage || allowedStages.has(stage);
  });
}

export function statusChoicesFor(application: {
  status: ApplicationStatus;
  allowed_next_statuses?: string[];
}): StatusEntry[] {
  const allowed = application.allowed_next_statuses;
  const next = Array.isArray(allowed)
    ? allowed
    : allowedNextStatuses(application.status);
  const allowedSet = new Set([application.status, ...next]);
  return STATUSES.filter((entry) => allowedSet.has(entry.id));
}

/** Statuses every selected job can move to (excludes each job's current status). */
export function commonAllowedStatuses(
  applications: Array<{
    status: ApplicationStatus;
    allowed_next_statuses?: string[];
  }>
): StatusEntry[] {
  if (!applications.length) return [];
  const sets = applications.map((application) => {
    return new Set(
      statusChoicesFor(application)
        .map((entry) => entry.id)
        .filter((id) => id !== application.status)
    );
  });
  const [first, ...rest] = sets;
  if (!first) return [];
  const common = [...first].filter((id) => rest.every((set) => set.has(id)));
  return STATUSES.filter((entry) => common.includes(entry.id));
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = Object.fromEntries(
  STATUSES.map((status) => [status.id, status.label])
) as Record<ApplicationStatus, string>;

const SALARY_CLAIM_STATUS_IDS: ApplicationStatus[] = [
  "applied",
  "screening",
  "interview",
  "forwarded",
  "offer",
  "accepted",
];

export function salaryClaimMissingOnApply(
  status: ApplicationStatus,
  salaryClaim: string,
  previousStatus?: ApplicationStatus | null
): boolean {
  if (!SALARY_CLAIM_STATUS_IDS.includes(status) || Boolean(salaryClaim?.trim())) {
    return false;
  }
  if (previousStatus == null) return true;
  return !SALARY_CLAIM_STATUS_IDS.includes(previousStatus);
}
