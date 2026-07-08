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

export const STATUS_LABELS: Record<ApplicationStatus, string> = Object.fromEntries(
  STATUSES.map((status) => [status.id, status.label])
) as Record<ApplicationStatus, string>;
