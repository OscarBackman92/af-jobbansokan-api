import { useEffect, useState } from "react";

import { request } from "../api.js";
import { downloadTodayActionsIcs } from "../calendar.js";
import { encodeMonthFilter, formatMonthLabel } from "../dates.js";
import SkillGapPanel from "./SkillGapPanel.jsx";
import MetricTile from "./board/MetricTile.jsx";

const MONTH_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

const FUNNEL_STEPS = [
  { key: "tracked", label: "Spårade" },
  { key: "applied", label: "Sökta" },
  { key: "responded", label: "Fått svar" },
  { key: "in_dialog", label: "I dialog" },
  { key: "interview", label: "Intervju" },
  { key: "offer", label: "Erbjudande" },
];

const OUTCOME_SEGMENTS = [
  { key: "rejected", label: "Avslag" },
  { key: "no_response", label: "Inget svar" },
  { key: "waiting", label: "Väntar" },
  { key: "fresh", label: "Nyligen sökta" },
];

const WAITING_BUCKETS = [
  { key: "d0_6", label: "0–6 dagar" },
  { key: "d7_10", label: "7–10 dagar" },
  { key: "d11_14", label: "11–14 dagar" },
  { key: "d15_plus", label: "15+ dagar" },
];

const MATCH_LABELS = {
  has_match: "Med CV-match",
  no_match: "Utan CV-match",
};

const PACE_ROWS = [
  { key: "applied_7d", label: "Sökta senaste 7 dagarna", suffix: "st" },
  { key: "saved_7d", label: "Sparade senaste 7 dagarna", suffix: "st" },
  { key: "save_apply_ratio", label: "Andel sparade som sökts", suffix: "" },
  {
    key: "median_days_saved_to_applied",
    label: "Median dagar sparad → sökt",
    suffix: "dagar",
  },
  {
    key: "median_days_to_response",
    label: "Median dagar till svar",
    suffix: "dagar",
  },
  { key: "followups_logged", label: "Uppföljningar loggade (7d)", suffix: "st" },
];

function Beraknas() {
  return <span className="tag">beräknas</span>;
}

function isMissing(value) {
  return value == null;
}

function pct(part, whole) {
  if (whole == null || whole <= 0 || part == null) return null;
  return Math.round((part / whole) * 100);
}

function monthShortLabel(monthKey) {
  const match = String(monthKey || "").match(/^\d{4}-(\d{2})$/);
  if (!match) return monthKey || "";
  const index = Number(match[1]) - 1;
  return MONTH_SHORT[index] || monthKey;
}

function headlineFromKpis(kpis) {
  const toApply = kpis.to_apply ?? 0;
  const followUp = kpis.follow_up ?? 0;
  return `${toApply} jobb ska sökas den här veckan. ${followUp} väntar på svar.`;
}

function toCalendarItem(action) {
  const summaryPrefix = action.kind === "deadline" ? "Ansök" : "Följ upp";
  return {
    application: {
      id: action.id,
      title: action.title,
      company: action.company,
    },
    kind: action.kind,
    date: action.date,
    label: action.label,
    calendarSummary: `${summaryPrefix}: ${action.title} @ ${action.company}`,
  };
}

function navigateForAction(action, onNavigate) {
  if (action.kind === "deadline") {
    onNavigate?.("saved", { filter: "urgent" });
    return;
  }
  onNavigate?.("applied", { filter: "late" });
}

function formatPaceValue(key, value) {
  if (isMissing(value)) return null;
  if (key === "save_apply_ratio") {
    return `${Math.round(Number(value) * 100)} %`;
  }
  return String(value);
}

export default function DashboardPanel({ token, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    request("/api/v1/dashboard/")
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Kunde inte hämta översikten.");
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="stack">
        <section className="command-hero command-hero--compact">
          <div className="command-hero-copy">
            <span className="section-kicker">Översikt</span>
            <h2>Din översikt</h2>
          </div>
        </section>
        <section className="card">
          <p className="error">{error}</p>
          <p className="muted">
            Försök igen om en stund. Siffror som saknas visas som{" "}
            <Beraknas />.
          </p>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stack">
        <section className="command-hero command-hero--compact">
          <div className="command-hero-copy">
            <span className="section-kicker">Översikt</span>
            <h2>Din översikt</h2>
          </div>
        </section>
        <section className="card">
          <div className="loading-row">
            <span className="spinner" /> Laddar översikt…
          </div>
        </section>
      </div>
    );
  }

  const kpis = data.kpis || {};
  const funnel = data.funnel || {};
  const nextActions = Array.isArray(data.next_actions)
    ? data.next_actions.slice(0, 5)
    : [];
  const monthly = Array.isArray(data.monthly) ? data.monthly : [];
  const outcomes = data.outcomes || null;
  const responseByMatch = Array.isArray(data.response_by_match)
    ? data.response_by_match
    : [];
  const topCompanies = Array.isArray(data.top_companies)
    ? data.top_companies
    : [];
  const waitingAge = data.waiting_age || null;
  const pace = data.pace || null;

  const tracked = funnel.tracked ?? 0;
  const monthlyMax = Math.max(1, ...monthly.map((m) => m.count || 0));
  const monthlySum = monthly.reduce((sum, m) => sum + (m.count || 0), 0);

  const outcomeValues = outcomes
    ? OUTCOME_SEGMENTS.map((seg) => ({
        ...seg,
        value: outcomes[seg.key],
      }))
    : [];
  const outcomesMissing =
    !outcomes || outcomeValues.some((seg) => isMissing(seg.value));
  const outcomesTotal = outcomesMissing
    ? 0
    : outcomeValues.reduce((sum, seg) => sum + (seg.value || 0), 0);

  const waitingValues = waitingAge
    ? WAITING_BUCKETS.map((bucket) => ({
        ...bucket,
        value: waitingAge[bucket.key],
      }))
    : [];
  const waitingMissing =
    !waitingAge || waitingValues.some((bucket) => isMissing(bucket.value));
  const waitingMax = waitingMissing
    ? 1
    : Math.max(1, ...waitingValues.map((bucket) => bucket.value || 0));

  function downloadNextActionsIcs() {
    const items = nextActions.map(toCalendarItem);
    downloadTodayActionsIcs(items, "jobbdjungeln-nasta-steg.ics");
  }

  return (
    <div className="stack">
      <section className="command-hero">
        <div className="command-hero-copy">
          <span className="section-kicker">Översikt</span>
          <h2>{headlineFromKpis(kpis)}</h2>
          <p className="muted">
            En läsvy som länkar vidare till sparade jobb och ansökningar.
          </p>
        </div>
        <div className="metric-grid" aria-label="Nyckeltal">
          <MetricTile
            label="Att söka"
            value={kpis.to_apply ?? 0}
            detail="den här veckan"
            tone={(kpis.urgent ?? 0) > 0 ? "amber" : "default"}
            filterId="urgent"
            onFilter={() => onNavigate?.("saved", { filter: "urgent" })}
          />
          <MetricTile
            label="Följ upp"
            value={kpis.follow_up ?? 0}
            detail="väntar för länge"
            tone={(kpis.follow_up ?? 0) > 0 ? "amber" : "default"}
            filterId="late"
            onFilter={() => onNavigate?.("applied", { filter: "late" })}
          />
          <MetricTile
            label="Sparade totalt"
            value={kpis.saved_total ?? 0}
            detail="wishlist"
            filterId="saved"
            onFilter={() => onNavigate?.("saved")}
          />
          <MetricTile
            label="Pågående ansökningar"
            value={kpis.active_applications ?? 0}
            detail="ej avslutade"
            filterId="fresh"
            onFilter={() => onNavigate?.("applied")}
          />
          <MetricTile
            label="I dialog"
            value={kpis.in_dialog ?? 0}
            detail="intervjuspår"
            tone="cyan"
            filterId="dialog"
            onFilter={() => onNavigate?.("applied", { filter: "dialog" })}
          />
          <MetricTile
            label="Erbjudande"
            value={kpis.offers ?? 0}
            detail="att ta ställning till"
            tone="green"
            filterId="offer"
            onFilter={() => onNavigate?.("applied", { filter: "offer" })}
          />
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Nästa steg — de fem närmaste</h2>
            <p className="muted">
              {nextActions.length === 0
                ? "Inget inplanerat den här veckan."
                : "Uppföljningar och sista ansökningsdagar närmast i tid."}
            </p>
          </div>
          {nextActions.length > 0 && (
            <button
              type="button"
              className="secondary small ics-knapp"
              onClick={downloadNextActionsIcs}
            >
              Lägg i kalender
            </button>
          )}
        </div>
        {nextActions.length === 0 ? (
          <p className="muted">När du planerar nästa steg syns de här.</p>
        ) : (
          <ul className="today-list">
            {nextActions.map((action) => (
              <li key={`${action.kind}-${action.id}-${action.date}`}>
                <div className="today-list-main">
                  <strong>
                    {action.title} @ {action.company}
                  </strong>
                  <span className="muted">{action.label}</span>
                </div>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => navigateForAction(action, onNavigate)}
                >
                  Visa
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SkillGapPanel token={token} onNavigate={onNavigate} />

      <section className="card">
        <h2>Tratten</h2>
        <p className="muted">
          Från spårade jobb till erbjudande. Procent mot spårade totalt, och
          andel från föregående steg.
        </p>
        <ol className="funnel" aria-label="Ansökningstratt">
          {FUNNEL_STEPS.map((step, index) => {
            const count = funnel[step.key] ?? 0;
            const ofTracked = pct(count, tracked);
            const prevKey = index > 0 ? FUNNEL_STEPS[index - 1].key : null;
            const ofPrev = prevKey ? pct(count, funnel[prevKey] ?? 0) : null;
            return (
              <li key={step.key}>
                <span className="funnel-label">{step.label}</span>
                <strong className="funnel-count">{count}</strong>
                <span className="funnel-pct muted">
                  {ofTracked == null ? (
                    <Beraknas />
                  ) : (
                    <>
                      {ofTracked}% av spårade
                      {ofPrev != null ? ` · ${ofPrev}% från föregående` : null}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h2>Ansökningar per månad</h2>
        <p className="muted">
          Sökt datum · {monthlySum} senaste 6 mån. Klicka en månad för att öppna
          Ansökningar med det filtret.
        </p>
        {monthly.length === 0 ? (
          <p className="muted">Inga sökta jobb med datum ännu.</p>
        ) : (
          <div
            className="chart"
            role="group"
            aria-label={`Ansökningar per månad: ${monthly
              .map((m) => `${monthShortLabel(m.month)} ${m.count}`)
              .join(", ")}`}
          >
            {monthly.map((m, index) => {
              const count = m.count || 0;
              const isCurrent = index === monthly.length - 1;
              const className = [
                "chart-col",
                "chart-col--clickable",
                isCurrent ? "chart-col--current" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  type="button"
                  className={className}
                  key={m.month}
                  title={`${count} st · filtrera på ${formatMonthLabel(m.month)}`}
                  aria-label={`Filtrera på ansökningar i ${formatMonthLabel(m.month)} (${count} st)`}
                  onClick={() =>
                    onNavigate?.("applied", {
                      monthFilter: encodeMonthFilter("applied", m.month),
                    })
                  }
                >
                  <span className="chart-count">{count}</span>
                  <div
                    className={
                      count === 0 ? "chart-bar chart-bar--empty" : "chart-bar"
                    }
                    style={{
                      height: `${count === 0 ? 8 : (count / monthlyMax) * 96 + 8}px`,
                    }}
                  />
                  <span className="chart-label">{monthShortLabel(m.month)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Utfall av {outcomesTotal || "—"} sökta</h2>
        <p className="muted">Avslag, inget svar, väntande och nyligen sökta.</p>
        {outcomesMissing ? (
          <Beraknas />
        ) : outcomesTotal === 0 ? (
          <p className="muted">Inga sökta jobb att visa utfall för ännu.</p>
        ) : (
          <>
            <div
              className="stack-bar"
              role="img"
              aria-label={outcomeValues
                .map((seg) => `${seg.label} ${seg.value}`)
                .join(", ")}
            >
              {outcomeValues.map((seg) =>
                seg.value > 0 ? (
                  <div
                    key={seg.key}
                    className={`stack-bar-seg stack-bar-seg--${seg.key}`}
                    style={{ flexGrow: seg.value, flexBasis: 0 }}
                    title={`${seg.label}: ${seg.value}`}
                  />
                ) : null
              )}
            </div>
            <ul className="stack-bar-legend">
              {outcomeValues.map((seg) => (
                <li key={seg.key}>
                  <span
                    className={`stack-bar-swatch stack-bar-seg--${seg.key}`}
                    aria-hidden="true"
                  />
                  {seg.label}: {seg.value}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h2>Svar per CV-matchning</h2>
        <p className="muted">Hur ofta du får svar när matchningen är hög respektive låg.</p>
        {responseByMatch.length === 0 ? (
          <Beraknas />
        ) : (
          <table className="pace-table">
            <thead>
              <tr>
                <th scope="col">Matchning</th>
                <th scope="col">Sökta</th>
                <th scope="col">Svar</th>
              </tr>
            </thead>
            <tbody>
              {responseByMatch.map((row) => {
                const appliedMissing = isMissing(row.applied);
                const respondedMissing = isMissing(row.responded);
                return (
                  <tr key={row.bucket}>
                    <td>{MATCH_LABELS[row.bucket] || row.bucket}</td>
                    <td>{appliedMissing ? <Beraknas /> : row.applied}</td>
                    <td>{respondedMissing ? <Beraknas /> : row.responded}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Var du söker mest</h2>
        <p className="muted">Företag med flest sökta ansökningar.</p>
        {topCompanies.length === 0 ? (
          <p className="muted">Inga sökta jobb ännu.</p>
        ) : (
          <ol className="top-companies">
            {topCompanies.map((row) => (
              <li key={row.company}>
                <span>{row.company}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h2>Hur länge de väntande har väntat</h2>
        <p className="muted">Fördelning bland ansökningar som fortfarande väntar på svar.</p>
        {waitingMissing ? (
          <Beraknas />
        ) : (
          <div className="histogram" role="list" aria-label="Väntetid">
            {waitingValues.map((bucket) => (
              <div className="histogram-row" role="listitem" key={bucket.key}>
                <span className="histogram-label">{bucket.label}</span>
                <div className="histogram-track">
                  <div
                    className="histogram-bar"
                    style={{
                      width: `${((bucket.value || 0) / waitingMax) * 100}%`,
                    }}
                  />
                </div>
                <strong className="histogram-count">{bucket.value ?? 0}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Din takt</h2>
        <p className="muted">Tempo och medianer för ditt jobbsök.</p>
        {!pace ? (
          <Beraknas />
        ) : (
          <table className="pace-table">
            <tbody>
              {PACE_ROWS.map((row) => {
                const formatted = formatPaceValue(row.key, pace[row.key]);
                return (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>
                      {formatted == null ? (
                        <Beraknas />
                      ) : (
                        <>
                          {formatted}
                          {row.suffix &&
                          row.key !== "save_apply_ratio"
                            ? ` ${row.suffix}`
                            : null}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
