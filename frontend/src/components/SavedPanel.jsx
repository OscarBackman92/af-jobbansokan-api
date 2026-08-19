import { useEffect, useMemo, useState } from "react";

import { addEvidenceTerm, coverGapInMatch } from "../addEvidence.js";
import { buildIcsCalendar, downloadIcs } from "../calendar.js";
import {
  applyByFor,
  compareByDateThenMatch,
  daysUntilApplyBy,
  savedBucket,
} from "../dates.js";
import { localISODate } from "../localDate.js";
import { matchesApplicationSearch } from "../text.js";
import ApplicationModal from "./ApplicationModal.jsx";
import MetricTile from "./board/MetricTile.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import MatchScore from "./MatchScore.jsx";
import ProfileFitRow from "./ProfileFitRow.jsx";
import ModalErrorBoundary from "./ModalErrorBoundary.jsx";
import { countSummary } from "../plural.js";

const GOOD_MATCH_PERCENT = 60;

const LANES = [
  {
    id: "urgent",
    label: "Bråttom",
    detail: "sök inom 7 dagar",
    empty: "Inga jobb med sök senast inom 7 dagar.",
  },
  {
    id: "month",
    label: "Den här månaden",
    detail: "planerade längre fram",
    empty: "Inga jobb planerade längre fram den här månaden.",
  },
  {
    id: "no_deadline",
    label: "Utan sista dag",
    detail: "auto-planerade",
    empty: "Inga sparade jobb utan arbetsgivarens sista dag.",
  },
  {
    id: "paused",
    label: "Lagt på is",
    detail: "pausade",
    empty: "Inga jobb lagda på is.",
  },
  {
    id: "expired",
    label: "Utgångna",
    detail: "passerad sök senast",
    empty: "Inga utgångna sparade jobb.",
  },
];

function isGoodMatch(application) {
  const match = application.match;
  if (!match) return false;
  if (match.confidence === "low" || match.band === "unknown") return false;
  if (match.score != null) return match.score >= GOOD_MATCH_PERCENT;
  if (!match?.total) return false;
  return (match.count / match.total) * 100 >= GOOD_MATCH_PERCENT;
}

function daysLeftLabel(days) {
  if (days === null) return null;
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? "1 dag sen" : `${overdue} dagar sen`;
  }
  if (days === 0) return "Idag";
  return days === 1 ? "1 dag kvar" : `${days} dagar kvar`;
}

function daysDueClass(days) {
  if (days === null) return "due";
  if (days < 0) return "due due--expired";
  if (days <= 3) return "due due--urgent";
  if (days <= 7) return "due due--soon";
  return "due";
}

function applicationToIcsEvent(application) {
  const date = applyByFor(application);
  if (!date) return null;
  const description = [
    `Sök senast: ${date}`,
    application.location && `Ort: ${application.location}`,
    application.contact_name && `Kontakt: ${application.contact_name}`,
    application.contact_info && application.contact_info,
    application.apply_url && `Ansök: ${application.apply_url}`,
    application.ad_url && `Annons: ${application.ad_url}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `jobbdjungeln-${application.id}-apply-${date}@jobbdjungeln`,
    date,
    summary: `Ansök: ${application.title} @ ${application.company}`,
    description,
  };
}

function downloadApplicationsIcs(rows, filename = "jobbdjungeln-sparade.ics") {
  const events = rows.map(applicationToIcsEvent).filter(Boolean);
  if (!events.length) return false;
  downloadIcs(filename, buildIcsCalendar(events));
  return true;
}

export default function SavedPanel({
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
}) {
  const [laneFilter, setLaneFilter] = useState(initialFilter || null);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [goodMatchOnly, setGoodMatchOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [planningId, setPlanningId] = useState(null);
  const [planForm, setPlanForm] = useState({ apply_by: "", next_action_at: "" });
  const [confirmAppliedId, setConfirmAppliedId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [expiredCollapsed, setExpiredCollapsed] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showWarmHint, setShowWarmHint] = useState(false);

  useEffect(() => {
    if (applications) return undefined;
    const timer = window.setTimeout(() => setShowWarmHint(true), 3000);
    return () => window.clearTimeout(timer);
  }, [applications]);

  useEffect(() => {
    function onDeselect() {
      setSelectedIds(new Set());
    }
    window.addEventListener("jobbdjungeln-deselect", onDeselect);
    return () => window.removeEventListener("jobbdjungeln-deselect", onDeselect);
  }, []);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialFilter) setLaneFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (laneFilter === "expired") setExpiredCollapsed(false);
  }, [laneFilter]);

  const saved = useMemo(
    () => (applications || []).filter((app) => app.status === "wishlist"),
    [applications]
  );

  const locations = useMemo(() => {
    const set = new Set();
    for (const app of saved) {
      const loc = (app.location || "").trim();
      if (loc) set.add(loc);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "sv"));
  }, [saved]);

  const filtered = useMemo(() => {
    return saved.filter((app) => {
      if (locationFilter && (app.location || "").trim() !== locationFilter) {
        return false;
      }
      if (goodMatchOnly && !isGoodMatch(app)) return false;
      if (!matchesApplicationSearch(app, query)) return false;
      if (laneFilter && savedBucket(app) !== laneFilter) return false;
      return true;
    });
  }, [saved, locationFilter, goodMatchOnly, query, laneFilter]);

  const groups = useMemo(() => {
    const byLane = Object.fromEntries(LANES.map((lane) => [lane.id, []]));
    for (const app of filtered) {
      const bucket = savedBucket(app);
      if (byLane[bucket]) byLane[bucket].push(app);
    }
    for (const lane of LANES) {
      byLane[lane.id].sort(compareByDateThenMatch);
    }
    const visibleLanes = laneFilter
      ? LANES.filter((lane) => lane.id === laneFilter)
      : LANES;
    return visibleLanes.map((lane) => ({
      ...lane,
      applications: byLane[lane.id],
    }));
  }, [filtered, laneFilter]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(LANES.map((lane) => [lane.id, 0]));
    for (const app of saved) {
      const bucket = savedBucket(app);
      if (bucket in result) result[bucket] += 1;
    }
    return result;
  }, [saved]);

  const visibleIds = filtered.map((app) => app.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const selectedVisible = filtered.filter((app) => selectedIds.has(app.id));
  const visibleUrgent = filtered.filter(
    (app) => savedBucket(app) === "urgent"
  );

  function applyLaneFilter(filterId) {
    setLaneFilter((current) => (current === filterId ? null : filterId));
  }

  function toggleSelect(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleIds));
  }

  function planWeek() {
    setSelectedIds(new Set(visibleUrgent.map((app) => app.id)));
    setLaneFilter("urgent");
    setExpiredCollapsed(true);
  }

  async function runBulk(ids, action, date) {
    if (!ids.length) return;
    try {
      setBusy(true);
      setError(null);
      await bulk({ ids, action, ...(date ? { date } : {}) });
      setSelectedIds(new Set());
      setConfirmAppliedId(null);
      if (planningId && ids.includes(planningId)) setPlanningId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function markApplied(ids) {
    return runBulk(ids, "mark_applied", localISODate());
  }

  function requestArchive(ids) {
    if (!ids.length) return;
    setArchiveTarget(ids);
  }

  async function confirmArchive() {
    if (!archiveTarget?.length) return;
    const ids = archiveTarget;
    setArchiveTarget(null);
    await runBulk(ids, "archive");
  }

  function calendarTargets() {
    if (selectedVisible.length) return selectedVisible;
    return visibleUrgent;
  }

  function handleCalendar() {
    const rows = calendarTargets();
    if (!rows.length) {
      setError("Inga jobb att lägga i kalendern.");
      return;
    }
    const ok = downloadApplicationsIcs(rows);
    if (!ok) setError("Inga datum att exportera till kalendern.");
  }

  function openApply(app) {
    const href = app.apply_url || app.ad_url;
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
    setConfirmAppliedId(app.id);
    setPlanningId(null);
  }

  function startPlanning(app) {
    if (planningId === app.id) {
      setPlanningId(null);
      return;
    }
    setPlanningId(app.id);
    setConfirmAppliedId(null);
    setPlanForm({
      apply_by: applyByFor(app) || "",
      next_action_at: app.next_action_at || "",
    });
  }

  async function savePlan(app) {
    try {
      setBusy(true);
      setError(null);
      await patch(app.id, {
        apply_by: planForm.apply_by || null,
        next_action_at: planForm.next_action_at || null,
      });
      setPlanningId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function calendarOne(app) {
    const ok = downloadApplicationsIcs(
      [app],
      `jobbdjungeln-${String(app.company || "jobb")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 24) || "paminnelse"}.ics`
    );
    if (!ok) setError("Saknar datum för kalendern.");
  }

  if (!applications) {
    return (
      <section className="card">
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="lane-skeleton" aria-busy="true" aria-label="Laddar">
            <div className="lane-skeleton-row" />
            <div className="lane-skeleton-row" />
            <div className="lane-skeleton-row" />
            {showWarmHint && (
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                Startar servern… det kan ta en stund efter vila.
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(locationFilter) ||
    goodMatchOnly ||
    Boolean(laneFilter);

  function resetFilters() {
    setQuery("");
    setLocationFilter("");
    setGoodMatchOnly(false);
    setLaneFilter(null);
  }

  return (
    <div className="stack">
      <section className="command-hero command-hero--compact">
        <div className="command-hero-copy">
          <span className="section-kicker">Sparade jobb</span>
          <h2>Det du vill söka</h2>
        </div>
        <div className="metric-grid" aria-label="Sparade jobb">
          {LANES.map((lane) => (
            <MetricTile
              key={lane.id}
              label={lane.label}
              value={counts[lane.id]}
              detail={lane.detail}
              tone={
                lane.id === "urgent" && counts.urgent > 0 ? "amber" : "default"
              }
              filterId={lane.id}
              onFilter={applyLaneFilter}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Sparade jobb</h2>
            <p className="muted">
              {saved.length === 0
                ? "Inga sparade jobb ännu."
                : `${countSummary(saved.length, "sparat", "sparade")} · ${countSummary(counts.urgent, "bråttom", "bråttom")}.`}
            </p>
          </div>
          <button type="button" className="small" onClick={() => setAdding(true)}>
            + Spara jobb
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {saved.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true" />
            <h3>Inget sparat ännu</h3>
            <p className="muted">
              Spara annonser från Platsbanken så dyker de upp här med sök senast.
            </p>
            <div className="empty-actions">
              <button type="button" onClick={() => onNavigate?.("postings")}>
                Sök annonser
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => onNavigate?.("profile")}
              >
                Fyll i CV
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="board-tools">
              {selectedVisible.length > 0 && (
                <div className="bulk-bar" role="toolbar" aria-label="Massåtgärder">
                  <span className="bulk-bar-count">
                    {selectedVisible.length} valda
                  </span>
                  <button
                    type="button"
                    className="small"
                    onClick={() =>
                      markApplied(selectedVisible.map((app) => app.id))
                    }
                    disabled={busy}
                  >
                    Markera som sökta
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() =>
                      requestArchive(selectedVisible.map((app) => app.id))
                    }
                    disabled={busy}
                  >
                    Släpp
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
                  onClick={selectAllVisible}
                  disabled={!visibleIds.length || busy}
                >
                  {allVisibleSelected ? "Avmarkera alla" : "Markera alla"}
                </button>
                <button
                  type="button"
                  className="small"
                  onClick={planWeek}
                  disabled={!visibleUrgent.length || busy}
                >
                  Planera veckan
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={handleCalendar}
                  disabled={busy}
                >
                  Lägg i kalender
                </button>
              </div>

              <div className="board-filters">
                <label className="month-filter-field">
                  <span className="sr-only">Filtrera på ort</span>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    aria-label="Filtrera på ort"
                  >
                    <option value="">Alla orter</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="quick-filters" aria-label="Filter">
                  <button
                    type="button"
                    className={goodMatchOnly ? "active" : ""}
                    aria-pressed={goodMatchOnly}
                    onClick={() => setGoodMatchOnly((v) => !v)}
                  >
                    Passar mitt CV
                  </button>
                </div>
              </div>

              <div className="board-search">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sök företag, roll, ort eller anteckning"
                  aria-label="Sök sparade jobb"
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
            </div>

            {hasActiveFilters && (
              <p className="muted filter-summary">
                <span>
                  Visar {filtered.length} av {saved.length}
                  {laneFilter && (
                    <>
                      {" "}
                      · spår:{" "}
                      <strong>
                        {LANES.find((lane) => lane.id === laneFilter)?.label ||
                          laneFilter}
                      </strong>
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

            <div className="lanes">
              {groups.map((lane) => {
                const isExpired = lane.id === "expired";
                const collapsed = isExpired && expiredCollapsed;
                return (
                  <section key={lane.id} className="lane" data-lane={lane.id}>
                    <div className="lane-head">
                      <button
                        type="button"
                        className="linklike"
                        onClick={() => {
                          if (isExpired) {
                            setExpiredCollapsed((v) => !v);
                            return;
                          }
                          applyLaneFilter(lane.id);
                        }}
                        aria-expanded={isExpired ? !collapsed : undefined}
                      >
                        <strong>{lane.label}</strong>
                        <span className="muted"> ({lane.applications.length})</span>
                        {isExpired && (
                          <span className="muted">
                            {collapsed ? " · visa" : " · dölj"}
                          </span>
                        )}
                      </button>
                    </div>

                    {!collapsed &&
                      (lane.applications.length === 0 ? (
                        <div className="lane-row lane-row--dim">
                          <p className="muted">{lane.empty}</p>
                        </div>
                      ) : (
                        lane.applications.map((app) => {
                          const days = daysUntilApplyBy(app);
                          const applyBy = applyByFor(app);
                          const chip = daysLeftLabel(days);
                          const rowClass = [
                            "lane-row",
                            lane.id === "urgent" ? "lane-row--urgent" : "",
                            lane.id === "paused" || lane.id === "expired"
                              ? "lane-row--dim"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ");
                          const meta = [
                            app.company,
                            app.location,
                            applyBy ? `sök senast ${applyBy}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ");

                          return (
                            <div key={app.id} className={rowClass}>
                              <label className="lane-select">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(app.id)}
                                  onChange={() => toggleSelect(app.id)}
                                  aria-label={`Markera ${app.title}`}
                                />
                              </label>
                              <div className="lane-row-main">
                                <button
                                  type="button"
                                  className="lane-row-title"
                                  onClick={() => setSelected(app)}
                                >
                                  {app.title}
                                </button>
                                <span className="lane-row-meta muted">
                                  {meta}
                                </span>
                                {app.match && (
                                  <MatchScore
                                    match={app.match}
                                    variant="compact"
                                    showMissing
                                    onAddEvidence={async (gap) => {
                                      try {
                                        await addEvidenceTerm(gap.term);
                                        const next = coverGapInMatch(
                                          app.match,
                                          gap
                                        );
                                        upsert?.({ ...app, match: next });
                                      } catch {
                                        /* keep gap */
                                      }
                                    }}
                                  />
                                )}
                                {app.match?.profiles_scored && (
                                  <ProfileFitRow
                                    profiles={app.match.profiles_scored}
                                  />
                                )}
                                {chip && (
                                  <span className={daysDueClass(days)}>
                                    {chip}
                                  </span>
                                )}
                              </div>

                              <div className="lane-actions">
                                {isExpired ? (
                                  <>
                                    <button
                                      type="button"
                                      className="small"
                                      disabled={busy}
                                      onClick={() => markApplied([app.id])}
                                    >
                                      Sökte ändå
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      disabled={busy}
                                      onClick={() => requestArchive([app.id])}
                                    >
                                      Släpp (arkivera)
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="small"
                                      disabled={busy}
                                      data-shortcut="apply"
                                      onClick={() => openApply(app)}
                                    >
                                      Ansök ↗
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      disabled={busy}
                                      data-shortcut="plan"
                                      onClick={() => startPlanning(app)}
                                      aria-expanded={planningId === app.id}
                                    >
                                      Planera
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      disabled={busy}
                                      onClick={() => requestArchive([app.id])}
                                    >
                                      Släpp
                                    </button>
                                  </>
                                )}
                              </div>

                              {confirmAppliedId === app.id && (
                                <div
                                  className="lane-confirm"
                                  role="status"
                                >
                                  <span>Markerade du som sökt?</span>
                                  <div className="row-gap">
                                    <button
                                      type="button"
                                      className="small"
                                      disabled={busy}
                                      onClick={() => markApplied([app.id])}
                                    >
                                      Ja, sökt idag
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      onClick={() => setConfirmAppliedId(null)}
                                    >
                                      Inte än
                                    </button>
                                  </div>
                                </div>
                              )}

                              {planningId === app.id && (
                                <div className="lane-plan">
                                  <label>
                                    Sök senast
                                    <span className="row-gap">
                                      <input
                                        type="date"
                                        value={planForm.apply_by}
                                        onChange={(e) =>
                                          setPlanForm((current) => ({
                                            ...current,
                                            apply_by: e.target.value,
                                          }))
                                        }
                                      />
                                      {app.apply_by_is_auto && (
                                        <span className="tag">auto</span>
                                      )}
                                    </span>
                                  </label>
                                  <label>
                                    Nästa steg
                                    <input
                                      type="date"
                                      value={planForm.next_action_at}
                                      onChange={(e) =>
                                        setPlanForm((current) => ({
                                          ...current,
                                          next_action_at: e.target.value,
                                        }))
                                      }
                                    />
                                  </label>
                                  <div className="lane-actions">
                                    <button
                                      type="button"
                                      className="small"
                                      disabled={busy}
                                      onClick={() => savePlan(app)}
                                    >
                                      Spara
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      disabled={busy}
                                      onClick={() => calendarOne(app)}
                                    >
                                      Lägg i kalender
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      disabled={busy}
                                      onClick={() =>
                                        runBulk([app.id], "pause")
                                      }
                                    >
                                      Lägg på is
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ))}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>

      {archiveTarget && (
        <ConfirmDialog
          title={
            archiveTarget.length === 1
              ? "Släpp sparat jobb?"
              : "Släpp sparade jobb?"
          }
          message={
            archiveTarget.length === 1
              ? "Jobbet arkiveras och försvinner från listan. Du tar inte bort det permanent."
              : `${archiveTarget.length} jobb arkiveras och försvinner från listan. Du tar inte bort dem permanent.`
          }
          cancelLabel="Avbryt"
          confirmLabel="Släpp"
          confirmClassName="danger"
          onCancel={() => setArchiveTarget(null)}
          onConfirm={confirmArchive}
        />
      )}

      {(selected || adding) && (
        <ModalErrorBoundary
          key={selected?.id ?? "new-saved"}
          onClose={() => {
            setSelected(null);
            setAdding(false);
          }}
        >
          <ApplicationModal
            token={token}
            application={selected}
            defaultStatus="wishlist"
            existingApplications={applications}
            onOpenExisting={(app) => {
              setSelected(app);
              setAdding(false);
            }}
            onClose={() => {
              setSelected(null);
              setAdding(false);
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
