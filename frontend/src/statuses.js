// Mirror of JobApplication.STATUS_CHOICES in the backend.

export const STATUSES = [
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

// Kanban columns; the rest live in the archive.
export const ACTIVE_STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "forwarded",
  "offer",
];

export const CLOSED_STATUSES = ["accepted", "rejected", "no_response", "withdrawn"];

export const STATUS_LABELS = Object.fromEntries(
  STATUSES.map((s) => [s.id, s.label])
);
