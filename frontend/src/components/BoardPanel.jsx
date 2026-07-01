import { useCallback, useEffect, useState } from "react";

import { downloadBlob, request } from "../api.js";
import { daysUntil } from "../dates.js";
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  STATUSES,
  STATUS_LABELS,
} from "../statuses.js";
import ApplicationModal from "./ApplicationModal.jsx";
import TodayPanel from "./TodayPanel.jsx";
const QUICK_FILTERS = [
  { id: "all", label: "Alla" },
  { id: "followups", label: "Att följa upp" },
  { id: "deadline", label: "Deadline snart" },
  { id: "interviews", label: "Intervjuer" },
  { id: "offers", label: "Erbjudanden" },
  { id: "closed", label: "Avslutade" },
];

function isClosed(application) {
  return CLOSED_STATUSES.includes(application.status);
}

function isFollowUp(application) {
  if (isClosed(application)) return false;
  const nextIn = daysUntil(application.next_action_at);
  if (nextIn !== null && nextIn <= 0) return true;
  const deadlineIn = daysUntil(application.deadline);
  return deadlineIn !== null && deadlineIn <= 7 && application.status === "wishlist";
}

function hasDeadlineSoon(application) {
  if (isClosed(application)) return false;
  const deadlineIn = daysUntil(application.deadline);
  return deadlineIn !== null && deadlineIn <= 7;
}

function matchesSearch(application, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [
    application.company,
    application.title,
    application.location,
    application.notes,
    application.contact_name,
    application.contact_info,
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function matchesQuickFilter(application, filter) {
  if (filter === "all") return true;
  if (filter === "followups") return isFollowUp(application);
  if (filter === "deadline") return hasDeadlineSoon(application);
  if (filter === "interviews") {
    return ["screening", "interview", "forwarded"].includes(application.status);
  }
  if (filter === "offers") {
    return ["offer", "accepted"].includes(application.status);
  }
  if (filter === "closed") return isClosed(application);
  return true;
}

function matchesListFilter(application, quickFilter, statusFilter) {
  if (statusFilter) {
    if (statusFilter === "closed") return isClosed(application);
    return application.status === statusFilter;
  }
  return matchesQuickFilter(application, quickFilter);
}

export default function BoardPanel({ token, onNavigate }) {
  const [applications, setApplications] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      // The board needs every row; one big page covers realistic
      // trackers, the loop only continues past 200 rows.
      let url = "/api/v1/applications/?page_size=200";
      const rows = [];
      while (url) {
        const page = await request(url, { token });
        rows.push(...page.results);
        url = page.next;
      }
      setApplications(rows);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("application-created", handler);
    return () => window.removeEventListener("application-created", handler);
  }, [reload]);

  async function moveTo(applicationId, status) {
    try {
      setError(null);
      await request(`/api/v1/applications/${applicationId}/`, {
        method: "PATCH",
        token,
        body: { status },
      });
      reload();
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

  if (!applications) {
    return (
      <section className="card">
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="loading-row">
            <span className="spinner" /> Laddar tavlan…
          </div>
        )}
      </section>
    );
  }

  const allClosed = applications.filter(isClosed);
  const filteredApplications = applications.filter(
    (a) =>
      matchesSearch(a, query) && matchesListFilter(a, quickFilter, statusFilter)
  );
  const closed = filteredApplications.filter(isClosed);
  const hasActiveFilters = query.trim() || quickFilter !== "all" || statusFilter;
  const followUps = applications
    .filter(isFollowUp)
    .sort(
      (a, b) =>
        new Date(a.next_action_at || a.deadline) -
        new Date(b.next_action_at || b.deadline)
    );

  function resetFilters() {
    setQuery("");
    setQuickFilter("all");
    setStatusFilter(null);
  }

  function selectQuickFilter(filterId) {
    setQuickFilter(filterId);
    setStatusFilter(null);
  }

  function toggleStatusFilter(statusId) {
    setQuickFilter("all");
    setStatusFilter((current) => (current === statusId ? null : statusId));
  }

  const countsByStatus = Object.fromEntries(
    STATUSES.map((status) => [
      status.id,
      applications.filter((a) => a.status === status.id).length,
    ])
  );
  const activeFiltered = filteredApplications.filter((a) => !isClosed(a));
  const activeGroups =
    statusFilter === "closed" || quickFilter === "closed"
      ? []
      : ACTIVE_STATUSES.map((status) => ({
          id: status,
          label: STATUS_LABELS[status],
          applications: activeFiltered.filter((a) => a.status === status),
        })).filter((group) => {
          if (statusFilter) return group.id === statusFilter;
          return group.applications.length > 0 || !hasActiveFilters;
        });
  const showClosedGroup =
    statusFilter === "closed" ||
    (!statusFilter && (closed.length > 0 || quickFilter === "closed"));
  const activeCount = applications.length - allClosed.length;
  const deadlineSoonCount = applications.filter(hasDeadlineSoon).length;
  const interviewTrackCount = applications.filter((a) =>
    ["screening", "interview", "forwarded"].includes(a.status)
  ).length;
  const offerCount = applications.filter((a) =>
    ["offer", "accepted"].includes(a.status)
  ).length;
  const acceptedCount = applications.filter((a) => a.status === "accepted").length;
  const winRate = allClosed.length
    ? Math.round((acceptedCount / allClosed.length) * 100)
    : 0;

  return (
    <div className="stack">
      <section className="command-hero">
        <div className="command-hero-copy">
          <span className="section-kicker">Ansökningsradar</span>
          <h2>Command center</h2>
          <p className="muted">
            Prioritera nästa drag, håll koll på pipeline och fånga signaler
            innan de blir brus.
          </p>
        </div>
        <div className="metric-grid" aria-label="Översikt">
          <MetricTile label="Pågående" value={activeCount} detail="aktiva case" />
          <MetricTile
            label="Följ upp"
            value={followUps.length}
            detail="behöver respons"
            tone="amber"
          />
          <MetricTile
            label="Deadline"
            value={deadlineSoonCount}
            detail="inom 7 dagar"
            tone="red"
          />
          <MetricTile
            label="Intervjuspår"
            value={interviewTrackCount}
            detail="i dialog"
            tone="cyan"
          />
          <MetricTile
            label="Erbjudande"
            value={offerCount}
            detail={`${winRate}% stängningsgrad`}
            tone="green"
          />
        </div>
      </section>

      <TodayPanel applications={applications} onOpen={setSelected} />

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Min tavla</h2>
            <p className="muted">
              {applications.length === 0
                ? "Tomt än så länge — lägg till din första ansökan."
                : `${applications.length} ansökningar, varav ${
                    applications.length - allClosed.length
                  } pågående. Följ flödet status för status.`}
            </p>
          </div>
          <div className="row-gap">
            <button className="secondary small" onClick={exportCsv}>
              Exportera CSV
            </button>
            <button className="small" onClick={() => setAdding(true)}>
              + Ny ansökan
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        {applications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true" />
            <h3>Din tavla är tom</h3>
            <p className="muted">
              Lägg till en ansökan manuellt, eller hitta en annons under
              fliken Annonser och lägg den på tavlan.
            </p>
            <div className="empty-actions">
              <button onClick={() => setAdding(true)}>
                + Lägg till din första ansökan
              </button>
              <button className="secondary" onClick={() => onNavigate?.("postings")}>
                Sök annonser
              </button>
              <button className="secondary" onClick={() => onNavigate?.("profile")}>
                Fyll i CV
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="board-tools">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök företag, roll, ort, kontakt eller anteckning"
              />
              <div className="quick-filters" aria-label="Snabbfilter">
                {QUICK_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.id}
                    className={quickFilter === filter.id && !statusFilter ? "active" : ""}
                    onClick={() => selectQuickFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <p className="muted filter-summary">
                Visar {filteredApplications.length} av {applications.length}.
                <button className="linklike" onClick={resetFilters}>
                  Rensa filter
                </button>
              </p>
            )}

            {filteredApplications.length === 0 ? (
              <div className="empty-state compact">
                <h3>Inga träffar</h3>
                <p className="muted">
                  Prova ett annat sökord eller byt snabbfilter.
                </p>
                <button className="secondary" onClick={resetFilters}>
                  Rensa filter
                </button>
              </div>
            ) : (
              <div className="pipeline">
                <PipelineSummary
                  countsByStatus={countsByStatus}
                  activeCount={activeCount}
                  closedCount={allClosed.length}
                  statusFilter={statusFilter}
                  onToggleStatus={toggleStatusFilter}
                />

                {activeGroups.map((group) => (
                  <PipelineStage
                    key={group.id}
                    status={group.id}
                    label={group.label}
                    applications={group.applications}
                    onOpen={setSelected}
                    onMove={moveTo}
                  />
                ))}

                {showClosedGroup && (
                  <PipelineStage
                    status="closed"
                    label="Avslutade"
                    applications={closed}
                    onOpen={setSelected}
                    onMove={moveTo}
                    emptyText="Inga avslutade ansökningar matchar filtret."
                  />
                )}
              </div>
            )}
          </>
        )}
      </section>

      <MonthlyStats applications={applications} />

      {(selected || adding) && (
        <ApplicationModal
          token={token}
          application={selected}
          existingApplications={applications}
          onOpenExisting={(app) => {
            setSelected(app);
            setAdding(false);
          }}
          onClose={() => {
            setSelected(null);
            setAdding(false);
          }}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function MetricTile({ label, value, detail, tone = "default" }) {
  return (
    <div className={`metric-tile metric-tile--${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

function PipelineSummary({
  countsByStatus,
  activeCount,
  closedCount,
  statusFilter,
  onToggleStatus,
}) {
  return (
    <div className="pipeline-summary" aria-label="Statusöversikt">
      {ACTIVE_STATUSES.map((status) => (
        <button
          type="button"
          key={status}
          className={`pipeline-step pipeline-step--${status}${
            statusFilter === status ? " active" : ""
          }`}
          onClick={() => onToggleStatus(status)}
          aria-pressed={statusFilter === status}
          title={`Filtrera: ${STATUS_LABELS[status]}`}
        >
          <span className="pipeline-step-label">{STATUS_LABELS[status]}</span>
          <span className="pipeline-step-count">{countsByStatus[status] || 0}</span>
        </button>
      ))}
      <button
        type="button"
        className={`pipeline-step pipeline-step--closed${
          statusFilter === "closed" ? " active" : ""
        }`}
        onClick={() => onToggleStatus("closed")}
        aria-pressed={statusFilter === "closed"}
        title="Filtrera: Avslutade"
      >
        <span className="pipeline-step-label">Avslutade</span>
        <span className="pipeline-step-count">{closedCount}</span>
      </button>
      <div className="pipeline-total" aria-hidden="true">
        <strong>{activeCount}</strong>
        <span>pågående</span>
      </div>
    </div>
  );
}

function PipelineStage({
  status,
  label,
  applications,
  onOpen,
  onMove,
  emptyText = "Inga ansökningar här just nu.",
}) {
  return (
    <section className={`pipeline-stage pipeline-stage--${status}`}>
      <div className="pipeline-stage-head">
        <h3>{label}</h3>
        <span>{applications.length}</span>
      </div>
      {applications.length === 0 ? (
        <p className="pipeline-empty">{emptyText}</p>
      ) : (
        <div className="pipeline-rows">
          {applications.map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              onOpen={() => onOpen(application)}
              onMove={(next) => onMove(application.id, next)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DeadlineBadge({ application }) {
  if (CLOSED_STATUSES.includes(application.status)) return null;
  const days = daysUntil(application.deadline);
  if (days === null || days > 14) return null;
  const tone = days <= 3 ? "rejected" : "interview";
  const text =
    days < 0
      ? "Deadline passerad"
      : days === 0
        ? "Deadline idag"
        : `Deadline om ${days} ${days === 1 ? "dag" : "dagar"}`;
  return <span className={`badge ${tone}`}>{text}</span>;
}

function ApplicationRow({ application, onOpen, onMove }) {
  const meta = [
    application.company,
    application.location,
    application.applied_at ? `Sökt ${application.applied_at}` : "",
    application.contact_name ? `Kontakt: ${application.contact_name}` : "",
  ].filter(Boolean);

  return (
    <div className={`pipeline-row pipeline-row--${application.status}`}>
      <button className="pipeline-row-main" onClick={onOpen}>
        <span className="pipeline-row-title">{application.title}</span>
        <span className="pipeline-row-meta">{meta.join(" · ")}</span>
        {(application.status_label ||
          application.deadline ||
          application.next_action_at) && (
          <span className="pipeline-row-badges">
            <span className={`badge ${application.status}`}>
              {application.status_label}
            </span>
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
        <button className="secondary small" onClick={onOpen}>
          Öppna
        </button>
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

function MonthlyStats({ applications }) {
  if (applications.length === 0) return null;

  // Applications per month, last six months.
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_NAMES[d.getMonth()],
      count: 0,
    });
  }
  for (const a of applications) {
    if (!a.applied_at) continue;
    const month = months.find((m) => a.applied_at.startsWith(m.key));
    if (month) month.count += 1;
  }
  const max = Math.max(1, ...months.map((m) => m.count));

  const inProcess = applications.filter((a) =>
    ["screening", "interview", "forwarded", "offer", "accepted"].includes(
      a.status
    )
  ).length;

  return (
    <section className="card">
      <h2>Statistik</h2>
      <p className="muted">
        {applications.length} ansökningar totalt · {inProcess} har lett till
        samtal, intervju eller längre.
      </p>
      <div className="chart">
        {months.map((m, i) => (
          <div
            className={
              i === months.length - 1 ? "chart-col chart-col--current" : "chart-col"
            }
            key={m.key}
            title={`${m.count} st`}
          >
            <span className="chart-count">{m.count || ""}</span>
            <div
              className="chart-bar"
              style={{ height: `${(m.count / max) * 96 + 6}px` }}
            />
            <span className="chart-label">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
