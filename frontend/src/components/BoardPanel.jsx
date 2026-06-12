import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  STATUSES,
  STATUS_LABELS,
} from "../statuses.js";
import ApplicationModal from "./ApplicationModal.jsx";

export default function BoardPanel({ token }) {
  const [applications, setApplications] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
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

  async function moveTo(application, status) {
    await request(`/api/v1/applications/${application.id}/`, {
      method: "PATCH",
      token,
      body: { status },
    });
    reload();
  }

  async function exportCsv() {
    const response = await fetch("/api/v1/applications/export/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ansokningar.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!applications) {
    return <section className="card">{error || "Laddar tavlan…"}</section>;
  }

  const closed = applications.filter((a) => CLOSED_STATUSES.includes(a.status));

  return (
    <div className="stack">
      <section className="card">
        <div className="row-between">
          <div>
            <h2>Min tavla</h2>
            <p className="muted">
              {applications.length === 0
                ? "Tomt än så länge — lägg till din första ansökan."
                : `${applications.length} ansökningar, varav ${
                    applications.length - closed.length
                  } pågående.`}
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

        <div className="board">
          {ACTIVE_STATUSES.map((status) => {
            const cards = applications.filter((a) => a.status === status);
            return (
              <div className="kcol" key={status}>
                <div className="kcol-head">
                  <span className={`badge ${status}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="muted">{cards.length}</span>
                </div>
                {cards.map((a) => (
                  <ApplicationCard
                    key={a.id}
                    application={a}
                    onOpen={() => setSelected(a)}
                    onMove={(status) => moveTo(a, status)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </section>

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

function ApplicationCard({ application, onOpen, onMove }) {
  return (
    <div className="kcard">
      <button className="linklike" onClick={onOpen}>
        {application.title}
      </button>
      <p className="muted">
        {application.company}
        {application.applied_at && ` · sökt ${application.applied_at}`}
      </p>
      {application.next_action_at && (
        <span className="badge interview">
          Nästa steg {application.next_action_at}
        </span>
      )}
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
  );
}
