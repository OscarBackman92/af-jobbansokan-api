import { daysUntil } from "../../dates.js";

export default function DeadlineBadge({ application }) {
  // Deadlines only matter while the row is still Sparad.
  if (application.status !== "wishlist") return null;
  const days = daysUntil(application.deadline);
  if (days === null || days > 14) return null;
  const tone =
    days < 0 ? "due--expired" : days <= 3 ? "due--urgent" : "due--soon";
  const text =
    days < 0
      ? "Deadline passerad"
      : days === 0
        ? "Deadline idag"
        : `Deadline om ${days} ${days === 1 ? "dag" : "dagar"}`;
  return <span className={`due ${tone}`}>{text}</span>;
}
