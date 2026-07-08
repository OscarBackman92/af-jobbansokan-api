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
import MatchScore from "./MatchScore.jsx";
import TodayPanel from "./TodayPanel.jsx";
import WelcomeGuide from "./WelcomeGuide.jsx";

const GOOD_MATCH_PERCENT = 40;

const QUICK_FILTERS = [
  { id: "all", label: "Alla" },
  { id: "good_match", label: "Passar mitt CV" },
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
  if (filter === "good_match") return isGoodMatch(application);
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

function isGoodMatch(application) {
  const match = application.match;
  if (!match?.total) return false;
  return (match.count / match.total) * 100 >= GOOD_MATCH_PERCENT;
}

function matchesStageFilter(application, stageFilter) {
  if (!stageFilter) return true;
  if (stageFilter === "closed") return isClosed(application);
  return application.status === stageFilter;
}

function stageFilterLabel(stageFilter) {
  if (!stageFilter) return "";
  if (stageFilter === "closed") return "Avslutade";
  return STATUS_LABELS[stageFilter] || stageFilter;
}

export default function BoardPanel({ token, onNavigate }) {
  const [applications, setApplications] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState(null);
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem("jobbsoket-welcome-dismissed") !== "1"
  );

  function dismissWelcome() {
    localStorage.setItem("jobbsoket-welcome-dismissed", "1");
    setShowWelcome(false);
  }

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
      matchesSearch(a, query) &&
      matchesQuickFilter(a, quickFilter) &&
      matchesStageFilter(a, stageFilter)
  );
  const closed = filteredApplications.filter(isClosed);
  const hasActiveFilters =
    query.trim() || quickFilter !== "all" || stageFilter !== null;
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
    setStageFilter(null);
  }

  function applyMetricFilter(filterId) {
    setStageFilter(null);
    setQuickFilter(filterId);
  }

  function toggleStageFilter(status) {
    setStageFilter((current) => (current === status ? null : status));
  }

  const activeFiltered = filteredApplications.filter((a) => !isClosed(a));
  // Empty stages are hidden: they carry no action, and the section
  // headers already tell the user where each application stands.
  const activeGroups =
    quickFilter === "closed" || stageFilter === "closed"
      ? []
      : ACTIVE_STATUSES.filter((status) => !stageFilter || stageFilter === status)
          .map((status) => ({
            id: status,
            label: STATUS_LABELS[status],
            applications: activeFiltered.filter((a) => a.status === status),
          }))
          .filter(
            (group) =>
              stageFilter === group.id || group.applications.length > 0
          );
  const activeCount = applications.length - allClosed.length;
  const deadlineSoonCount = applications.filter(hasDeadlineSoon).length;
  const interviewTrackCount = applications.filter((a) =>
    ["screening", "interview", "forwarded"].includes(a.status)
  ).length;
  const offerCount = applications.filter((a) =>
    ["offer", "accepted"].includes(a.status)
  ).length;

  return (
    <div className="stack">
      <section className="command-hero">
        <div className="command-hero-copy">
          <span className="section-kicker">Din tavla</span>
          <h2>Överblicken</h2>
          <p className="muted">
            Här ser du pågående ansökningar, vad som behöver följas upp och var
            varje process befinner sig.
          </p>
        </div>
        <div className="metric-grid" aria-label="Översikt">
          <MetricTile
            label="Pågående"
            value={activeCount}
            detail="ansökningar"
            filterId="all"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Följ upp"
            value={followUps.length}
            detail="behöver respons"
            tone="amber"
            filterId="followups"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Deadline"
            value={deadlineSoonCount}
            detail="inom 7 dagar"
            tone="red"
            filterId="deadline"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Intervjuspår"
            value={interviewTrackCount}
            detail="i dialog"
            tone="cyan"
            filterId="interviews"
            onFilter={applyMetricFilter}
          />
          <MetricTile
            label="Erbjudande"
            value={offerCount}
            detail="att ta ställning till"
            tone="green"
            filterId="offers"
            onFilter={applyMetricFilter}
          />
        </div>
      </section>

      {showWelcome && applications.length === 0 && (
        <WelcomeGuide onDismiss={dismissWelcome} onNavigate={onNavigate} />
      )}

      <TodayPanel applications={applications} onOpen={setSelected} />

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Min tavla</h2>
            <p className="muted">
              {applications.length === 0
                ? showWelcome
                  ? "Lägg till din första ansökan när du är redo."
                  : "Tomt än så länge — lägg till din första ansökan."
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

        {applications.length === 0 && !showWelcome ? (
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
        ) : applications.length === 0 ? (
          <div className="empty-actions empty-actions--inline">
            <button onClick={() => setAdding(true)}>+ Lägg till ansökan</button>
            <button className="secondary" onClick={() => onNavigate?.("postings")}>
              Sök annonser
            </button>
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
                    className={quickFilter === filter.id ? "active" : ""}
                    onClick={() => setQuickFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <p className="muted filter-summary">
                Visar {filteredApplications.length} av {applications.length}
                {stageFilter && (
                  <>
                    {" "}
                    · status: <strong>{stageFilterLabel(stageFilter)}</strong>
                  </>
                )}
                .
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
                {activeGroups.map((group) => (
                  <PipelineStage
                    key={group.id}
                    status={group.id}
                    label={group.label}
                    applications={group.applications}
                    activeFilter={stageFilter}
                    onFilterToggle={toggleStageFilter}
                    onOpen={setSelected}
                    onMove={moveTo}
                  />
                ))}

                {(stageFilter === "closed" || !stageFilter) && closed.length > 0 && (
                  <PipelineStage
                    status="closed"
                    label="Avslutade"
                    applications={closed}
                    activeFilter={stageFilter}
                    onFilterToggle={toggleStageFilter}
                    onOpen={setSelected}
                    onMove={moveTo}
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

function MetricTile({ label, value, detail, tone = "default", filterId, onFilter }) {
  const className = `metric-tile metric-tile--${tone}${
    filterId ? " metric-tile--interactive" : ""
  }`;
  const content = (
    <>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </>
  );
  if (filterId && onFilter) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onFilter(filterId)}
        aria-label={`Filtrera: ${label}`}
      >
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

function PipelineStage({
  status,
  label,
  applications,
  activeFilter,
  onFilterToggle,
  onOpen,
  onMove,
}) {
  const isActive = activeFilter === status;
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
          <h3>{label}</h3>
          <span>{applications.length}</span>
        </button>
      </div>
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

  // The stage header already names the status for active rows; only the
  // mixed "Avslutade" group needs a badge to tell outcomes apart.
  const showStatusBadge = isClosed(application);
  const deadlineIn = daysUntil(application.deadline);
  const showDeadlineBadge =
    !isClosed(application) && deadlineIn !== null && deadlineIn <= 14;
  const hasBadges =
    showStatusBadge || showDeadlineBadge || application.next_action_at;

  return (
    <div className={`pipeline-row pipeline-row--${application.status}`}>
      <button className="pipeline-row-main" onClick={onOpen}>
        <span className="pipeline-row-title">{application.title}</span>
        <span className="pipeline-row-meta">{meta.join(" · ")}</span>
        {application.match && (
          <MatchScore match={application.match} variant="compact" showMissing={false} />
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
