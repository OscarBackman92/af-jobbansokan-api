import { useState } from "react";

import ApplicationRow from "./ApplicationRow.jsx";

const STAGE_VISIBLE = 25;

export default function PipelineStage({
  status,
  label,
  applications,
  activeFilter,
  onFilterToggle,
  onOpen,
  onMove,
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = activeFilter === status;
  const visible = expanded
    ? applications
    : applications.slice(0, STAGE_VISIBLE);
  const canToggleExpand = applications.length > STAGE_VISIBLE;

  return (
    <section className={`pipeline-stage pipeline-stage--${status}`}>
      <div
        className={
          isActive
            ? "pipeline-stage-head pipeline-stage-head--active"
            : "pipeline-stage-head"
        }
      >
        <button
          type="button"
          className="pipeline-stage-filter"
          onClick={() => onFilterToggle(status)}
          aria-pressed={isActive}
          title={
            isActive
              ? `Visa alla statusar (filtrerar på ${label})`
              : `Visa bara ${label}`
          }
        >
          <span className="pipeline-stage-filter-label">
            <h3>{label}</h3>
            <span className="pipeline-stage-filter-hint" aria-hidden="true">
              {isActive ? "Filtrerad" : "Filtrera"}
            </span>
          </span>
          <span className="pipeline-stage-count">{applications.length}</span>
        </button>
      </div>
      <div className="pipeline-rows">
        {visible.map((application) => (
          <ApplicationRow
            key={application.id}
            application={application}
            onOpen={() => onOpen(application)}
            onMove={(next) => onMove(application.id, next)}
          />
        ))}
      </div>
      {canToggleExpand && (
        <button
          type="button"
          className="secondary small pipeline-show-more"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Visa mindre" : `Visa alla ${applications.length}`}
        </button>
      )}
    </section>
  );
}
