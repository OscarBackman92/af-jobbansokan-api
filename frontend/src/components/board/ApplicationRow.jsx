import { daysUntil, isClosed } from "../../dates.js";
import { STATUSES } from "../../statuses.js";
import MatchScore from "../MatchScore.jsx";
import DeadlineBadge from "./DeadlineBadge.jsx";

export default function ApplicationRow({ application, onOpen, onMove }) {
  const meta = [
    application.company,
    application.location,
    application.applied_at ? `Sökt ${application.applied_at}` : "",
    application.contact_name ? `Kontakt: ${application.contact_name}` : "",
  ].filter(Boolean);

  // The stage header already names the status for active rows; only the
  // mixed "Avslutade" group needs a badge to tell outcomes apart.
  const showStatusBadge = isClosed(application);
  const deadlineIn = daysUntil(application.deadline);
  const showDeadlineBadge =
    application.status === "wishlist" &&
    deadlineIn !== null &&
    deadlineIn <= 14;
  const hasBadges =
    showStatusBadge || showDeadlineBadge || application.next_action_at;

  return (
    <div className={`pipeline-row pipeline-row--${application.status}`}>
      <button className="pipeline-row-main" onClick={onOpen}>
        <span className="pipeline-row-title">{application.title}</span>
        <span className="pipeline-row-meta">{meta.join(" · ")}</span>
        {application.match && (
          <MatchScore
            match={application.match}
            variant="compact"
            showMissing={false}
          />
        )}
        {hasBadges && (
          <span className="pipeline-row-badges">
            {showStatusBadge && (
              <span className={`badge ${application.status}`}>
                {application.status_label}
              </span>
            )}
            <DeadlineBadge application={application} />
            {application.next_action_at && (
              <span className="badge neutral">
                Nästa steg {application.next_action_at}
              </span>
            )}
          </span>
        )}
      </button>
      <div className="pipeline-row-actions">
        <select
          value={application.status}
          onChange={(e) => onMove(e.target.value)}
          title="Flytta till status"
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
