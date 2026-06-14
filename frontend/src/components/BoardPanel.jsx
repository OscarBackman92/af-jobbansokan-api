import { useCallback, useEffect, useState } from "react";

import { downloadBlob, request } from "../api.js";
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  STATUSES,
  STATUS_LABELS,
} from "../statuses.js";
import ApplicationModal from "./ApplicationModal.jsx";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateString) - today) / DAY_MS);
}

export default function BoardPanel({ token }) {
  const [applications, setApplications] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      // The board needs every row; walk the pagination.
      let url = "/api/v1/applications/";
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
    await request(`/api/v1/applications/${applicationId}/`, {
      method: "PATCH",
      token,
      body: { status },
    });
    reload();
  }

  function dropOn(event, status) {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/plain");
    if (id) moveTo(id, status);
  }

  async function exportCsv() {
    const blob = await downloadBlob("/api/v1/applications/export/");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ansokningar.csv";
    link.click();
    URL.revokeObjectURL(url);
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

  const closed = applications.filter((a) => CLOSED_STATUSES.includes(a.status));
  const followUps = applications
    .filter((a) => {
      if (CLOSED_STATUSES.includes(a.status)) return false;
      const nextIn = daysUntil(a.next_action_at);
      if (nextIn !== null && nextIn <= 0) return true;
      const deadlineIn = daysUntil(a.deadline);
      return (
        deadlineIn !== null && deadlineIn <= 7 && a.status === "wishlist"
      );
    })
    .sort(
      (a, b) =>
        new Date(a.next_action_at || a.deadline) -
        new Date(b.next_action_at || b.deadline)
    );

  return (
    <div className="stack">
      {followUps.length > 0 && (
        <section className="card followups">
          <h2>Att följa upp</h2>
          <ul className="followup-list">
            {followUps.map((a) => {
              const nextIn = daysUntil(a.next_action_at);
              const reason =
                nextIn !== null && nextIn <= 0
                  ? nextIn === 0
                    ? "nästa steg idag"
                    : `nästa steg ${a.next_action_at} har passerat`
                  : `sista ansökningsdag ${a.deadline}`;
              return (
                <li key={a.id}>
                  <button className="linklike" onClick={() => setSelected(a)}>
                    {a.title} — {a.company}
                  </button>{" "}
                  <span className="muted">({reason})</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Min tavla</h2>
            <p className="muted">
              {applications.length === 0
                ? "Tomt än så länge — lägg till din första ansökan."
                : `${applications.length} ansökningar, varav ${
                    applications.length - closed.length
                  } pågående. Dra korten mellan kolumnerna.`}
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
            <div className="empty-emoji" aria-hidden="true">🗂️</div>
            <h3>Din tavla är tom</h3>
            <p className="muted">
              Lägg till en ansökan manuellt, eller hitta en annons under
              fliken Annonser och lägg den på tavlan.
            </p>
            <button onClick={() => setAdding(true)}>+ Lägg till din första ansökan</button>
          </div>
        ) : (
          <div className="board">
            {ACTIVE_STATUSES.map((status) => {
              const cards = applications.filter((a) => a.status === status);
              return (
                <div
                  className={`kcol kcol--${status}${
                    dragOver === status ? " dragover" : ""
                  }`}
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(status);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => dropOn(e, status)}
                >
                  <div className="kcol-head">
                    <span className="kcol-title">{STATUS_LABELS[status]}</span>
                    <span className="kcol-count">{cards.length}</span>
                  </div>
                  {cards.length === 0 ? (
                    <div className="kcol-empty">Dra hit</div>
                  ) : (
                    cards.map((a) => (
                      <ApplicationCard
                        key={a.id}
                        application={a}
                        onOpen={() => setSelected(a)}
                        onMove={(next) => moveTo(a.id, next)}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <MonthlyStats applications={applications} />

      {closed.length > 0 && (
        <section className="card">
          <h2>Avslutade</h2>
          <table>
            <thead>
              <tr>
                <th>Företag</th>
                <th>Roll</th>
                <th>Status</th>
                <th>Sökt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {closed.map((a) => (
                <tr key={a.id}>
                  <td>{a.company}</td>
                  <td>{a.title}</td>
                  <td>
                    <span className={`badge ${a.status}`}>{a.status_label}</span>
                  </td>
                  <td>{a.applied_at || "—"}</td>
                  <td>
                    <button
                      className="secondary small"
                      onClick={() => setSelected(a)}
                    >
                      Öppna
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(selected || adding) && (
        <ApplicationModal
          token={token}
          application={selected}
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

function ApplicationCard({ application, onOpen, onMove }) {
  return (
    <div
      className={`kcard kcard--${application.status}`}
      draggable
      onDragStart={(e) =>
        e.dataTransfer.setData("text/plain", String(application.id))
      }
    >
      <button className="kcard-body" onClick={onOpen}>
        <span className="kcard-company">{application.company}</span>
        <span className="kcard-title">{application.title}</span>
      </button>
      {(application.applied_at ||
        application.deadline ||
        application.next_action_at) && (
        <div className="kcard-badges">
          {application.applied_at && (
            <span className="kcard-date">Sökt {application.applied_at}</span>
          )}
          <DeadlineBadge application={application} />
          {application.next_action_at && (
            <span className="badge neutral">
              Nästa steg {application.next_action_at}
            </span>
          )}
        </div>
      )}
      <select
        className="kcard-move"
        value={application.status}
        onChange={(e) => onMove(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        title="Flytta till status"
      >
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
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
