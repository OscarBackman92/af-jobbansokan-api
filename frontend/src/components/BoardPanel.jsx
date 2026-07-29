import { useCallback, useEffect, useRef, useState } from "react";

import { downloadBlob, request } from "../api.js";
import {
  compareApplicationsByApplied,
  daysUntil,
  hasDeadlineSoon,
  isClosed,
  isFollowUp,
} from "../dates.js";
import { localISODate } from "../localDate.js";
import {
  ACTIVE_STATUSES,
  STATUSES,
  STATUS_LABELS,
} from "../statuses.js";
import { foldDiacritics } from "../text.js";
import ApplicationModal from "./ApplicationModal.jsx";
import ModalErrorBoundary from "./ModalErrorBoundary.jsx";
import ModalOverlay from "./ModalOverlay.jsx";
import MatchScore from "./MatchScore.jsx";
import TodayPanel from "./TodayPanel.jsx";
import WelcomeGuide from "./WelcomeGuide.jsx";

const GOOD_MATCH_PERCENT = 20;
const STAGE_VISIBLE = 25;
const FUNNEL_STATUSES = [
  "screening",
  "interview",
  "forwarded",
  "offer",
  "accepted",
];

const QUICK_FILTERS = [
  { id: "all", label: "Alla" },
  { id: "good_match", label: "Passar mitt CV" },
  { id: "followups", label: "Att följa upp" },
  { id: "deadline", label: "Deadline snart" },
  { id: "interviews", label: "Intervjuer" },
  { id: "offers", label: "Erbjudanden" },
  { id: "closed", label: "Avslutade" },
];

function matchesSearch(application, query) {
  const terms = foldDiacritics(query)
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return true;
  const haystack = foldDiacritics(
    [
      application.company,
      application.title,
      application.location,
      application.notes,
      application.contact_name,
      application.contact_info,
      application.source,
    ]
      .filter(Boolean)
      .join(" ")
  );
  return terms.every((term) => haystack.includes(term));
}

function matchesOneQuickFilter(application, filter) {
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

/** Empty filter list = show all. Multiple chips combine with AND. */
function matchesQuickFilters(application, filters) {
  if (!filters.length) return true;
  return filters.every((filter) => matchesOneQuickFilter(application, filter));
}

function isGoodMatch(application) {
  const match = application.match;
  if (!match?.total) return false;
  return (match.count / match.total) * 100 >= GOOD_MATCH_PERCENT;
}

function hasCvSkills(applications) {
  return applications.some((a) => a.match?.total > 0);
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
  const [quickFilters, setQuickFilters] = useState([]);
  const [stageFilter, setStageFilter] = useState(null);
  const [undo, setUndo] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [pendingDate, setPendingDate] = useState(() => localISODate());
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem("jobbsoket-welcome-dismissed") !== "1"
  );
  const listSectionRef = useRef(null);

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

  useEffect(() => {
    if (!undo) return undefined;
    const timer = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  function requestMove(applicationId, status) {
    const current = applications?.find((a) => a.id === applicationId);
    const previousStatus = current?.status;
    if (!previousStatus || previousStatus === status) return;
    // Capture ids up front so a list re-render cannot retarget the change.
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
      await request(`/api/v1/applications/${id}/`, {
        method: "PATCH",
        token,
        body: { status: nextStatus, status_changed_at },
      });
      setUndo({ id, previousStatus, title });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function undoStatusChange() {
    if (!undo) return;
    try {
      setError(null);
      await request(`/api/v1/applications/${undo.id}/`, {
        method: "PATCH",
        token,
        body: { status: undo.previousStatus },
      });
      setUndo(null);
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
            <span className="spinner" /> Laddar ansökningar…
          </div>
        )}
      </section>
    );
  }

  const allClosed = applications.filter(isClosed);
  const filteredApplications = applications.filter(
    (a) =>
      matchesSearch(a, query) &&
      matchesQuickFilters(a, quickFilters) &&
      matchesStageFilter(a, stageFilter)
  );
  const closed = filteredApplications
    .filter(isClosed)
    .sort(compareApplicationsByApplied);
  const hasActiveFilters =
    query.trim() || quickFilters.length > 0 || stageFilter !== null;
  const followUps = applications
    .filter(isFollowUp)
    .sort(compareApplicationsByApplied);
  const cvReady = hasCvSkills(applications);
  const goodMatchEmpty =
    quickFilters.includes("good_match") &&
    !cvReady &&
    filteredApplications.length === 0;
  const goodMatchNoHits =
    quickFilters.includes("good_match") &&
    cvReady &&
    filteredApplications.length === 0;

  function resetFilters() {
    setQuery("");
    setQuickFilters([]);
    setStageFilter(null);
  }

  function toggleQuickFilter(filterId) {
    setStageFilter(null);
    if (filterId === "all") {
      setQuickFilters([]);
      return;
    }
    setQuickFilters((current) =>
      current.includes(filterId)
        ? current.filter((id) => id !== filterId)
        : [...current, filterId]
    );
  }

  function applyMetricFilter(filterId) {
    setStageFilter(null);
    setQuickFilters(filterId === "all" ? [] : [filterId]);
    requestAnimationFrame(() => {
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function toggleStageFilter(status) {
    setQuickFilters([]);
    setStageFilter((current) => (current === status ? null : status));
  }

  const activeFiltered = filteredApplications.filter((a) => !isClosed(a));
  // Empty stages are hidden: they carry no action, and the section
  // headers already tell the user where each application stands.
  const activeGroups =
    quickFilters.includes("closed") || stageFilter === "closed"
      ? []
      : ACTIVE_STATUSES.filter((status) => !stageFilter || stageFilter === status)
          .map((status) => ({
            id: status,
            label: STATUS_LABELS[status],
            applications: activeFiltered
              .filter((a) => a.status === status)
              .sort(compareApplicationsByApplied),
          }))
          .filter(
            (group) =>
              stageFilter === group.id || group.applications.length > 0
          );
  const activeCount = applications.length - allClosed.length;
  const deadlineSoonCount = applications.filter((a) =>
    hasDeadlineSoon(a)
  ).length;
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
          <span className="section-kicker">Ansökningar</span>
          <h2>Din översikt</h2>
          <p className="muted">
            Vad som pågår, vad som väntar svar, och vad du ska ta tag i härnäst.
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

      <section className="card" ref={listSectionRef}>
        <div className="row-between">
          <div>
            <h2>Mina ansökningar</h2>
            <p className="muted">
              {applications.length === 0
                ? showWelcome
                  ? "Lägg till en ansökan när du vill."
                  : "Tomt här — börja med en ansökan."
                : `${applications.length} totalt, ${
                    applications.length - allClosed.length
                  } pågående.`}
            </p>
          </div>
          <div className="row-gap">
            <button type="button" className="secondary small" onClick={exportCsv}>
              Exportera CSV
            </button>
            <button type="button" className="small" onClick={() => setAdding(true)}>
              + Ny ansökan
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        {applications.length === 0 && !showWelcome ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true" />
            <h3>Inget här än</h3>
            <p className="muted">
              Lägg till en ansökan själv, eller spara något från Platsbanken under
              fliken Annonser.
            </p>
            <div className="empty-actions">
              <button onClick={() => setAdding(true)}>
                + Ny ansökan
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
              <div className="quick-filters" aria-label="Snabbfilter">
                {QUICK_FILTERS.map((filter) => {
                  const active =
                    filter.id === "all"
                      ? quickFilters.length === 0
                      : quickFilters.includes(filter.id);
                  return (
                    <button
                      type="button"
                      key={filter.id}
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      onClick={() => toggleQuickFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasActiveFilters && (
              <p className="muted filter-summary">
                <span>
                  Visar {filteredApplications.length} av {applications.length}
                  {stageFilter && (
                    <>
                      {" "}
                      · status: <strong>{stageFilterLabel(stageFilter)}</strong>
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

            {filteredApplications.length === 0 ? (
              <div className="empty-state compact">
                <h3>Inga träffar</h3>
                {goodMatchEmpty ? (
                  <>
                    <p className="muted">
                      Markera kompetenser under Profil &amp; CV för att filtrera
                      på matchning.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => onNavigate?.("profile", { focus: "skills" })}
                    >
                      Öppna Profil &amp; CV
                    </button>
                  </>
                ) : goodMatchNoHits ? (
                  <>
                    <p className="muted">
                      Ingen av dina ansökningar nådde tröskeln för CV-match
                      (minst {GOOD_MATCH_PERCENT}% eller två kompetenser). Prova
                      färre eller mer precisa markeringar, eller byt sökprofil.
                    </p>
                    <div className="empty-actions empty-actions--inline">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onNavigate?.("profile", { focus: "skills" })}
                      >
                        Justera kompetenser
                      </button>
                      <button type="button" className="secondary" onClick={resetFilters}>
                        Rensa filter
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Prova ett annat sökord eller byt snabbfilter.
                    </p>
                    <button className="secondary" onClick={resetFilters}>
                      Rensa filter
                    </button>
                  </>
                )}
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
                    onMove={requestMove}
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
                    onMove={requestMove}
                  />
                )}
              </div>
            )}
          </>
        )}
      </section>

      <MonthlyStats applications={applications} />

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
          <label htmlFor="status-change-date">
            Datum för statusbytet
            <input
              id="status-change-date"
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
          key={selected?.id ?? "new"}
          onClose={() => {
            setSelected(null);
            setAdding(false);
          }}
        >
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
        </ModalErrorBoundary>
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

function DeadlineBadge({ application }) {
  // Deadlines only matter while the row is still Sparad.
  if (application.status !== "wishlist") return null;
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

  // Applications per month, last six months (rows with applied_at only).
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
  const datedSum = months.reduce((sum, m) => sum + m.count, 0);

  const inProcess = applications.filter(
    (a) => a.reached_interview || FUNNEL_STATUSES.includes(a.status)
  ).length;

  return (
    <section className="card">
      <h2>Statistik</h2>
      <p className="muted">
        Ansökningar per månad (sökt datum) · {datedSum} med datum senaste 6 mån
        av {applications.length} totalt · {inProcess} har lett till samtal,
        intervju eller längre.
      </p>
      <div
        className="chart"
        role="img"
        aria-label={`Ansökningar per månad: ${months
          .map((m) => `${m.label} ${m.count}`)
          .join(", ")}`}
      >
        {months.map((m, i) => (
          <div
            className={
              i === months.length - 1 ? "chart-col chart-col--current" : "chart-col"
            }
            key={m.key}
            title={`${m.count} st`}
          >
            <span className="chart-count">{m.count}</span>
            <div
              className={
                m.count === 0 ? "chart-bar chart-bar--empty" : "chart-bar"
              }
              style={{
                height: `${m.count === 0 ? 8 : (m.count / max) * 96 + 8}px`,
              }}
            />
            <span className="chart-label">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
