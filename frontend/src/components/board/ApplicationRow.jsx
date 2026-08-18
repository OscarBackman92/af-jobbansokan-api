import { daysUntil, isClosed } from "../../dates.js";
import { STATUS_LABELS, statusChoicesFor } from "../../statuses.js";
import MatchScore from "../MatchScore.jsx";
import DeadlineBadge from "./DeadlineBadge.jsx";
import ProfileFitRow from "../ProfileFitRow.jsx";

export default function ApplicationRow({
  application,
  onOpen,
  onMove,
  onLog,
}) {
  const meta = [
    application.company,
    application.location,
    application.applied_at ? `Sökt ${application.applied_at}` : "",
    application.contact_name ? `Kontakt: ${application.contact_name}` : "",
  ].filter(Boolean);

  const showStatusBadge = isClosed(application);
  const deadlineIn = daysUntil(application.deadline);
  const showDeadlineBadge =
    application.status === "wishlist" &&
    deadlineIn !== null &&
    deadlineIn <= 14;
  const hasBadges =
    showStatusBadge || showDeadlineBadge || application.next_action_at;
  const statusChoices = statusChoicesFor(application);

  return (
    <div className={`pipeline-row pipeline-row--${application.status}`}>
      <div className="pipeline-row-main">
        <button
          type="button"
          className="pipeline-row-title"
          onClick={onOpen}
        >
          {application.title}
        </button>
        <span className="pipeline-row-meta">{meta.join(" · ")}</span>
        {application.match && (
          <MatchScore
            match={application.match}
            variant="compact"
            showMissing
          />
        )}
        {application.match?.profiles_scored && (
          <ProfileFitRow profiles={application.match.profiles_scored} />
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
      </div>
      <div className="pipeline-row-actions">
        <label className="status-chip">
          <span className="status-chip-current">
            {application.status_label || STATUS_LABELS[application.status]}
          </span>
          <select
            value={application.status}
            onChange={(e) => onMove(e.target.value)}
            aria-label="Byt steg"
            title="Flytta till status"
          >
            {statusChoices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {onLog && (
          <button
            type="button"
            className="secondary small"
            onClick={onLog}
          >
            Logga händelse
          </button>
        )}
      </div>
    </div>
  );
}
