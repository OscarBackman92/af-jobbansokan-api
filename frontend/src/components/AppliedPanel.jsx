import { useEffect, useRef, useState } from "react";

import { downloadBlob } from "../api.js";
import {
  downloadSingleActionIcs,
  downloadTodayActionsIcs,
} from "../calendar.js";
import {
  appliedBucket,
  compareByDateThenMatch,
  encodeMonthFilter,
  formatMonthLabel,
  isFollowUp,
  matchesMonthFilter,
  parseMonthFilter,
} from "../dates.js";
import { localISODate } from "../localDate.js";
import { STATUS_LABELS, STATUSES } from "../statuses.js";
import { matchesApplicationSearch } from "../text.js";
import ApplicationModal from "./ApplicationModal.jsx";
import MetricTile from "./board/MetricTile.jsx";
import ApplicationRow from "./board/ApplicationRow.jsx";
import ModalErrorBoundary from "./ModalErrorBoundary.jsx";
import ModalOverlay from "./ModalOverlay.jsx";
import PeriodStrip from "./PeriodStrip.jsx";

const STAGE_VISIBLE = 25;

const LANES = [
  {
    id: "late",
    label: "Väntar för länge",
    empty:
      "Här hamnar ansökningar som väntat utan svar i minst en vecka.",
  },
  {
    id: "fresh",
    label: "Nyligen sökta",
    empty: "Nyligen sökta ansökningar som fortfarande väntar på svar.",
  },
  {
    id: "dialog",
    label: "I dialog",
    empty:
      "Telefonintervju, intervju och skickad vidare samlas här när du kommer vidare.",
  },
  {
    id: "offer",
    label: "Erbjudande",
    empty: "Erbjudanden och accepterade roller visas här.",
  },
  {
    id: "closed",
    label: "Avslutade",
    empty: "Avslag, inget svar och återkallade ansökningar samlas här.",
  },
];

const APPLIED_STATUSES = STATUSES.filter((s) => s.id !== "wishlist");

const LANE_FILTER_IDS = new Set(LANES.map((lane) => lane.id));

function followUpIcsItem(application, date = localISODate()) {
  return {
    application,
    kind: "followup",
    date,
    label: `Uppföljning ${date}`,
    calendarSummary: `Följ upp: ${application.title} @ ${application.company}`,
  };
}

function monthFilterLabel(monthFilter) {
  const parsed = parseMonthFilter(monthFilter);
  if (!parsed) return "";
  return `Ansökt: ${formatMonthLabel(parsed.monthKey)}`;
}

export default function AppliedPanel({
  token,
  applications,
  reload,
  upsert,
  error,
  setError,
  patch,
  bulk,
  onNavigate,
  initialFilter,
  initialMonthFilter,
  periods = [],
}) {
  const [selected, setSelected] = useState(null);
  const [modalFocus, setModalFocus] = useState(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [laneFilter, setLaneFilter] = useState(() =>
    LANE_FILTER_IDS.has(initialFilter) ? initialFilter : null
  );
  const [followupsOnly, setFollowupsOnly] = useState(
    () => initialFilter === "followups"
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => initialMonthFilter || "");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [closedExpanded, setClosedExpanded] = useState(false);
  const [undo, setUndo] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [pendingDate, setPendingDate] = useState(() => localISODate());
  const listSectionRef = useRef(null);

  useEffect(() => {
    if (!undo) return undefined;
    const timer = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (LANE_FILTER_IDS.has(initialFilter)) {
      setLaneFilter(initialFilter);
      setFollowupsOnly(false);
    } else if (initialFilter === "followups") {
      setFollowupsOnly(true);
      setLaneFilter(null);
    }
  }, [initialFilter]);

  useEffect(() => {
    if (initialMonthFilter !== undefined && initialMonthFilter !== null) {
      setMonthFilter(initialMonthFilter || "");
    }
  }, [initialMonthFilter]);

  useEffect(() => {
    function onDeselect() {
      setSelectedIds(new Set());
    }
    window.addEventListener("jobbdjungeln-deselect", onDeselect);
    return () => window.removeEventListener("jobbdjungeln-deselect", onDeselect);
  }, []);

  function requestMove(applicationId, status) {
    const current = applications?.find((a) => a.id === applicationId);
    const previousStatus = current?.status;
    if (!previousStatus || previousStatus === status) return;
    setPendingDate(localISODate());
    setPendingMove({
      id: applicationId,
      previousStatus,
      nextStatus: status,
      title: current.title,
      company: current.company,
    });
  }

  async function confirmPendingMove() {
    if (!pendingMove) return;
    const { id, previousStatus, nextStatus, title } = pendingMove;
    const status_changed_at = pendingDate.trim() || localISODate();
    setPendingMove(null);
    try {
      setError(null);
      await patch(id, { status: nextStatus, status_changed_at });
      setUndo({ id, previousStatus, title });
    } catch (err) {
      setError(err.message);
    }
  }

  async function undoStatusChange() {
    if (!undo) return;
    try {
      setError(null);
      await patch(undo.id, { status: undo.previousStatus });
      setUndo(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportCsv() {
    try {
      const blob = await downloadBlob("/api/v1/applications/export/");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ansokningar.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function followUpIds(ids) {
    if (!ids.length) return;
    const today = localISODate();
    try {
      setError(null);
      await Promise.all(ids.map((id) => patch(id, { next_action_at: today })));
    } catch (err) {
      setError(err.message);
    }
  }

  function calendarForApplications(apps) {
    const today = localISODate();
    const items = apps
      .filter((app) => app.status !== "wishlist")
      .map((app) =>
        followUpIcsItem(app, app.next_action_at || today)
      );
    if (!items.length) return;
    downloadTodayActionsIcs(items, "jobbdjungeln-uppfoljning.ics");
  }

  if (!applications) {
    return (
      <section className="card">
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="loading-row">
            <span className="spinner" /> Laddar ansökningar…
          </div>
        )}
      </section>
    );
  }

  const sought = applications.filter((a) => a.status !== "wishlist");
  const stale = sought.filter((a) => a.is_stale);
  const counts = { late: 0, fresh: 0, dialog: 0, offer: 0, closed: 0 };
  for (const app of sought) {
    const bucket = appliedBucket(app);
    if (bucket in counts) counts[bucket] += 1;
  }

  const filtered = sought.filter(
    (a) =>
      matchesApplicationSearch(a, query) &&
      matchesMonthFilter(a, monthFilter) &&
      (!statusFilter || a.status === statusFilter) &&
      (!followupsOnly || isFollowUp(a)) &&
      (!laneFilter || appliedBucket(a) === laneFilter)
  );

  const groups = LANES.map((lane) => ({
    ...lane,
    applications: filtered
      .filter((a) => appliedBucket(a) === lane.id)
      .sort(compareByDateThenMatch),
  }));

  const visibleIds = filtered.map((a) => a.id);
  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(monthFilter) ||
    Boolean(statusFilter) ||
    followupsOnly ||
    laneFilter !== null;

  function resetFilters() {
    setQuery("");
    setMonthFilter("");
    setStatusFilter("");
    setLaneFilter(null);
    setFollowupsOnly(false);
  }

  function applyMetricFilter(filterId) {
    if (filterId === "followups") {
      setFollowupsOnly(true);
      setLaneFilter(null);
    } else if (LANE_FILTER_IDS.has(filterId)) {
      setFollowupsOnly(false);
      setLaneFilter((current) => (current === filterId ? null : filterId));
    }
    requestAnimationFrame(() => {
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function toggleSelected(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectVisible() {
    setSelectedIds((current) => {
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => current.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }

  const selectedApps = sought.filter((a) => selectedIds.has(a.id));
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  return (
    <div className="stack">
      <section className="command-hero command-hero--compact">
        <div className="command-hero-copy">
          <span className="section-kicker">Ansökningar</span>
          <h2>Sökta jobb</h2>
        </div>
        <div className="metric-grid" aria-label="Översikt sökta">
          <MetricTile
            label="Nyligen sökta"
            value={counts.fresh}
            detail="väntar svar"
            filterId="fresh"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Väntar för länge"
            value={counts.late}
            detail="behöver uppföljning"
            tone={counts.late > 0 ? "amber" : "default"}
            filterId="late"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="I dialog"
            value={counts.dialog}
            detail="intervjuspår"
            tone="cyan"
            filterId="dialog"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Erbjudande"
            value={counts.offer}
            detail="att ta ställning till"
            tone="green"
            filterId="offer"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Avslutade"
            value={counts.closed}
            detail="arkiv"
            filterId="closed"
            onFilter={applyMetricFilter}
          />
        </div>
      </section>

      {stale.length > 0 && (
        <div className="report-banner report-banner--notice" role="status">
          <p>
            {stale.length} ansökningar har väntat över 45 dagar utan svar.
            Stäng dem samlat så att tidsstämpeln blir densamma.
          </p>
          <button
            type="button"
            className="secondary small"
            onClick={async () => {
              try {
                setError(null);
                await bulk({
                  ids: stale.map((row) => row.id),
                  action: "close_no_response",
                });
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Stäng alla {stale.length} som inget svar
          </button>
        </div>
      )}

      <section className="card" ref={listSectionRef}>
        <div className="row-between">
          <div>
            <h2>Mina ansökningar</h2>
            <p className="muted">
              {sought.length === 0
                ? "Inga sökta jobb än — markera sparade som sökta när du skickat ansökan."
                : `${sought.length} sökta · ${counts.late} väntar för länge.`}
            </p>
          </div>
          <div className="row-gap">
            <button
              type="button"
              className="small"
              onClick={() => {
                setModalFocus(null);
                setAdding(true);
              }}
            >
              + Ny ansökan
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={exportCsv}
            >
              Exportera CSV
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        {sought.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true" />
            <h3>Inga sökta jobb</h3>
            <p className="muted">
              Spara annonser under Sparade jobb och markera dem som sökta när du
              har skickat ansökan.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => onNavigate?.("saved")}
              >
                Öppna Sparade jobb
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => onNavigate?.("postings")}
              >
                Sök annonser
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="board-tools">
              {selectedIds.size > 0 && (
                <div className="bulk-bar" role="toolbar" aria-label="Massåtgärder">
                  <span className="bulk-bar-count">{selectedIds.size} valda</span>
                  <button
                    type="button"
                    className="small"
                    onClick={() => followUpIds([...selectedIds])}
                  >
                    Följ upp valda
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => calendarForApplications(selectedApps)}
                  >
                    Lägg uppföljningar i kalender
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Avmarkera
                  </button>
                </div>
              )}
              <div className="row-gap" style={{ flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={toggleSelectVisible}
                >
                  {allVisibleSelected ? "Avmarkera alla" : "Markera alla"}
                </button>
              </div>
              <div className="board-search">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sök företag, roll, ort, kontakt eller anteckning"
                  aria-label="Sök ansökningar"
                />
                {query && (
                  <button
                    type="button"
                    className="board-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Rensa sökning"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="board-filters month-filters">
                <PeriodStrip
                  periods={periods}
                  selectedKey={parseMonthFilter(monthFilter)?.monthKey || ""}
                  onSelect={(key) =>
                    setMonthFilter(
                      key ? encodeMonthFilter("applied", key) : ""
                    )
                  }
                />
                <label className="month-filter-field">
                  <span className="sr-only">Filtrera på status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filtrera på status"
                  >
                    <option value="">Alla statusar</option>
                    {APPLIED_STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {hasActiveFilters && (
              <p className="muted filter-summary">
                <span>
                  Visar {filtered.length} av {sought.length}
                  {laneFilter && (
                    <>
                      {" "}
                      · grupp:{" "}
                      <strong>
                        {LANES.find((l) => l.id === laneFilter)?.label ||
                          laneFilter}
                      </strong>
                    </>
                  )}
                  {followupsOnly && (
                    <>
                      {" "}
                      · <strong>Att följa upp</strong>
                    </>
                  )}
                  {statusFilter && (
                    <>
                      {" "}
                      · status:{" "}
                      <strong>
                        {STATUS_LABELS[statusFilter] || statusFilter}
                      </strong>
                    </>
                  )}
                  {monthFilter && (
                    <>
                      {" "}
                      · månad: <strong>{monthFilterLabel(monthFilter)}</strong>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="linklike"
                  onClick={resetFilters}
                >
                  Rensa filter
                </button>
              </p>
            )}

            <div className="pipeline">
              {groups.map((group) => {
                const isClosedLane = group.id === "closed";
                const visibleApps =
                  isClosedLane && !closedExpanded
                    ? group.applications.slice(0, STAGE_VISIBLE)
                    : group.applications;
                const canToggleExpand =
                  isClosedLane && group.applications.length > STAGE_VISIBLE;
                const isActive = laneFilter === group.id;

                return (
                  <section
                    key={group.id}
                    className={`lane pipeline-stage pipeline-stage--${group.id}`}
                    data-lane={group.id}
                  >
                    <div
                      className={
                        isActive
                          ? "lane-head pipeline-stage-head pipeline-stage-head--active"
                          : "lane-head pipeline-stage-head"
                      }
                    >
                      <button
                        type="button"
                        className="pipeline-stage-filter"
                        onClick={() =>
                          setLaneFilter((current) =>
                            current === group.id ? null : group.id
                          )
                        }
                        aria-pressed={isActive}
                      >
                        <span className="pipeline-stage-filter-label">
                          <h3>{group.label}</h3>
                          <span
                            className="pipeline-stage-filter-hint"
                            aria-hidden="true"
                          >
                            {isActive ? "Filtrerad" : "Filtrera"}
                          </span>
                        </span>
                        <span className="pipeline-stage-count">
                          {group.applications.length}
                        </span>
                      </button>
                    </div>
                    <div className="pipeline-rows">
                      {group.applications.length === 0 ? (
                        <p className="muted lane-row lane-row--dim">{group.empty}</p>
                      ) : (
                        visibleApps.map((application) => (
                          <div
                            key={application.id}
                            className={`lane-row lane-row--${group.id}`}
                          >
                            <label className="lane-select">
                              <span className="sr-only">
                                Markera {application.title}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(application.id)}
                                onChange={() => toggleSelected(application.id)}
                              />
                            </label>
                            <ApplicationRow
                              application={application}
                              onOpen={() => {
                                setModalFocus(null);
                                setSelected(application);
                              }}
                              onLog={() => {
                                setModalFocus("timeline");
                                setSelected(application);
                              }}
                              onMove={(next) =>
                                requestMove(application.id, next)
                              }
                            />
                            <div className="lane-actions">
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => followUpIds([application.id])}
                              >
                                Följ upp
                              </button>
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() =>
                                  downloadSingleActionIcs(
                                    followUpIcsItem(
                                      application,
                                      application.next_action_at ||
                                        localISODate()
                                    )
                                  )
                                }
                              >
                                Kalender
                              </button>
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() =>
                                  requestMove(application.id, "no_response")
                                }
                              >
                                Avsluta
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {canToggleExpand && (
                      <button
                        type="button"
                        className="secondary small pipeline-show-more"
                        onClick={() => setClosedExpanded((value) => !value)}
                      >
                        {closedExpanded
                          ? "Visa mindre"
                          : `Visa alla ${group.applications.length}`}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>

      {pendingMove && (
        <ModalOverlay
          onClose={() => setPendingMove(null)}
          className="modal status-change-modal"
          labelledBy="status-change-title"
        >
          <div className="modal-head">
            <div className="modal-head-text">
              <h2 id="status-change-title">Byt status</h2>
              <p className="muted">
                {pendingMove.title} @ {pendingMove.company}
                {" → "}
                {STATUS_LABELS[pendingMove.nextStatus] || pendingMove.nextStatus}
              </p>
            </div>
            <button
              type="button"
              className="secondary small modal-close"
              onClick={() => setPendingMove(null)}
              aria-label="Stäng"
            >
              ✕
            </button>
          </div>
          <label htmlFor="applied-status-change-date">
            Datum för statusbytet
            <input
              id="applied-status-change-date"
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
            />
          </label>
          <div className="row-gap" style={{ marginTop: "1rem" }}>
            <button type="button" onClick={confirmPendingMove}>
              Bekräfta
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setPendingMove(null)}
            >
              Avbryt
            </button>
          </div>
        </ModalOverlay>
      )}

      {undo && (
        <div className="undo-toast" role="status">
          <span>
            Status ändrad för {undo.title}.{" "}
            <button type="button" className="linklike" onClick={undoStatusChange}>
              Ångra
            </button>
          </span>
          <button
            type="button"
            className="secondary small"
            onClick={() => setUndo(null)}
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>
      )}

      {(selected || adding) && (
        <ModalErrorBoundary
          key={selected?.id ?? "new-applied"}
          onClose={() => {
            setSelected(null);
            setAdding(false);
          }}
        >
          <ApplicationModal
            token={token}
            application={selected}
            existingApplications={applications}
            initialFocus={modalFocus}
            onOpenExisting={(app) => {
              setSelected(app);
              setAdding(false);
              setModalFocus(null);
            }}
            onClose={() => {
              setSelected(null);
              setAdding(false);
              setModalFocus(null);
            }}
            onChanged={(row) => {
              if (row && upsert) upsert(row);
              else reload();
            }}
          />
        </ModalErrorBoundary>
      )}
    </div>
  );
}
