import { useEffect, useMemo, useState } from "react";

import { downloadBlob, request } from "../api.js";
import { parseMonthFilter } from "../dates.js";
import OccupationPicker from "./OccupationPicker.jsx";
import PeriodStrip from "./PeriodStrip.jsx";

const ACTIVITY_TYPES = [
  { id: "rekryteringstraff", label: "Rekryteringsträff / mässa" },
  { id: "kurs", label: "Kurs / utbildning" },
  { id: "spontanansokan", label: "Spontanansökan" },
  { id: "natverkande", label: "Nätverkskontakt" },
  { id: "cv_arbete", label: "CV / personligt brev" },
  { id: "mote_af", label: "Möte med AF eller leverantör" },
  { id: "ovrigt", label: "Övrigt" },
];

const STATUS_LABEL = {
  pagaende: "Pågående",
  klar: "Klar att rapportera",
  rapporterad: "Rapporterad",
  forsenad: "Försenad",
};

function clipboardLine(row) {
  return [row.datum, row.yrke, row.arbetsgivare, row.ort, row.lank]
    .map((part) => part || "")
    .join("\t");
}

function jobToClip(job) {
  return clipboardLine({
    datum: job.applied_at,
    yrke: job.occupation_label,
    arbetsgivare: job.company,
    ort: job.location,
    lank: job.ad_url,
  });
}

function eventToClip(event, jobsById) {
  const job = jobsById.get(event.application_id) || {};
  return clipboardLine({
    datum: event.occurred_at,
    yrke: job.occupation_label,
    arbetsgivare: job.company,
    ort: job.location,
    lank: job.ad_url,
  });
}

function activityToClip(activity) {
  return clipboardLine({
    datum: activity.occurred_on,
    yrke: "",
    arbetsgivare: activity.organisation,
    ort: "",
    lank: "",
  });
}

export function selectPeriodKey(periods = [], storedKey = "", urlKey = "") {
  if (storedKey) return storedKey;
  if (urlKey) return urlKey;
  return periods[periods.length - 1]?.key || "";
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export default function ReportPanel({
  token,
  periods = [],
  onPeriodsReload,
  initialMonthFilter = "",
}) {
  const parsed = parseMonthFilter(initialMonthFilter);
  const [key, setKey] = useState(parsed?.monthKey || "");
  const selectedKey = selectPeriodKey(periods, key, parsed?.monthKey);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState({
    type: "kurs",
    occurred_on: new Date().toISOString().slice(0, 10),
    title: "",
    organisation: "",
    note: "",
  });

  useEffect(() => {
    if (parsed?.monthKey) setKey(parsed.monthKey);
  }, [parsed?.monthKey]);

  useEffect(() => {
    if (!token || !selectedKey) return undefined;
    let cancelled = false;
    setError(null);
    request(`/api/v1/periods/${selectedKey}/`)
      .then((body) => {
        if (!cancelled) setDetail(body);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Kunde inte hämta perioden.");
          setDetail(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedKey]);

  const jobs = useMemo(() => detail?.jobs || [], [detail]);
  const events = detail?.events || [];
  const activities = detail?.activities || [];
  const excludedJobs = useMemo(() => detail?.excluded_jobs || [], [detail]);
  const jobsById = useMemo(() => {
    const map = new Map();
    for (const job of jobs) map.set(job.id, job);
    for (const job of excludedJobs) map.set(job.id, job);
    return map;
  }, [jobs, excludedJobs]);

  async function reloadDetail() {
    const body = await request(`/api/v1/periods/${selectedKey}/`);
    setDetail(body);
    onPeriodsReload?.();
  }

  async function exclude(kind, id, excluded, note = "") {
    setBusy(true);
    try {
      const body = await request(`/api/v1/periods/${selectedKey}/exclude/`, {
        method: "POST",
        body: { kind, id, excluded, note },
      });
      setDetail(body);
      onPeriodsReload?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveOccupation(job, fields) {
    try {
      await request(`/api/v1/applications/${job.id}/`, {
        method: "PATCH",
        body: fields,
      });
      await reloadDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addActivity(event) {
    event.preventDefault();
    if (!activity.title.trim()) return;
    setBusy(true);
    try {
      await request("/api/v1/activities/", {
        method: "POST",
        body: activity,
      });
      setActivity((prev) => ({ ...prev, title: "", organisation: "", note: "" }));
      await reloadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markReported() {
    if (
      !window.confirm(
        "Markera perioden som rapporterad? Du kan öppna den igen senare."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const body = await request(`/api/v1/periods/${selectedKey}/submit/`, {
        method: "POST",
      });
      setDetail(body);
      onPeriodsReload?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const blob = await downloadBlob(`/api/v1/periods/${selectedKey}/export/`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aktivitetsrapport-${selectedKey}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyAll() {
    const lines = [
      ...jobs.map(jobToClip),
      ...events.map((event) => eventToClip(event, jobsById)),
      ...activities.map(activityToClip),
    ];
    try {
      await copyText(lines.join("\n"));
    } catch (err) {
      setError(err.message || "Kunde inte kopiera.");
    }
  }

  if (!selectedKey) {
    return (
      <section className="card">
        <h2>Rapportera</h2>
        <p className="muted">Inga sökta perioder ännu.</p>
      </section>
    );
  }

  const missing = detail?.missing_occupation_count || 0;

  return (
    <section className="stack report-panel">
      <div className="card">
        <h2>Rapportera</h2>
        <p className="muted">
          Förbered aktivitetsrapporten. Appen lämnar inte in åt dig — kopiera
          raderna till AF:s formulär.
        </p>
        <PeriodStrip
          periods={periods}
          selectedKey={selectedKey}
          onSelect={(next) => setKey(next || selectedKey)}
        />
        {detail && (
          <p>
            <strong>{detail.label}</strong>
            {" · "}
            {STATUS_LABEL[detail.status] || detail.status}
            {" · lämna in senast "}
            {detail.window_closes}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        {missing > 0 && (
          <p className="error">
            {missing} sökta jobb saknar yrke och går inte att rapportera som de
            är.
          </p>
        )}
        <div className="row-gap" style={{ flexWrap: "wrap" }}>
          <button type="button" className="secondary small" onClick={copyAll}>
            Kopiera alla rader
          </button>
          <button type="button" className="secondary small" onClick={exportCsv}>
            Exportera CSV
          </button>
          {detail?.status !== "rapporterad" && (
            <button
              type="button"
              className="small"
              onClick={markReported}
              disabled={busy}
            >
              Markera perioden som rapporterad
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Sökta jobb</h3>
        {jobs.length === 0 ? (
          <p className="muted">Inga sökta jobb i perioden.</p>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Yrke</th>
                  <th>Arbetsgivare</th>
                  <th>Ort</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className={
                      job.occupation_label ? undefined : "report-row--warn"
                    }
                  >
                    <td>{job.applied_at || "—"}</td>
                    <td>
                      {job.occupation_label || (
                        <OccupationPicker
                          label=""
                          value=""
                          onChange={(fields) => saveOccupation(job, fields)}
                        />
                      )}
                    </td>
                    <td>
                      {job.company}
                      <div className="muted">{job.title}</div>
                    </td>
                    <td>
                      {job.location || "—"}
                      {job.ad_url ? (
                        <div>
                          <a href={job.ad_url} target="_blank" rel="noreferrer">
                            Annons
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td className="report-row-actions">
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => copyText(jobToClip(job))}
                      >
                        Kopiera
                      </button>
                      <button
                        type="button"
                        className="linklike small"
                        disabled={busy}
                        onClick={() =>
                          exclude(
                            "job",
                            job.id,
                            true,
                            window.prompt("Varför utesluta?") || ""
                          )
                        }
                      >
                        Uteslut ur rapporten
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {excludedJobs.length > 0 && (
          <p className="muted">
            {excludedJobs.length} uteslutna.{" "}
            {excludedJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                className="linklike"
                onClick={() => exclude("job", job.id, false)}
              >
                Ångra {job.company}
              </button>
            ))}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Övriga aktiviteter</h3>
        <ul className="report-activity-list">
          {events.map((event) => (
            <li key={`event-${event.id}`}>
              <span>
                {event.occurred_at} · {event.note}
              </span>
              <span className="report-row-actions">
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => copyText(eventToClip(event, jobsById))}
                >
                  Kopiera
                </button>
                <button
                  type="button"
                  className="linklike small"
                  onClick={() => exclude("event", event.id, true)}
                >
                  Uteslut
                </button>
              </span>
            </li>
          ))}
          {activities.map((row) => (
            <li key={`activity-${row.id}`}>
              <span>
                {row.occurred_on} · {row.title}
                {row.organisation ? ` (${row.organisation})` : ""}
              </span>
              <span className="report-row-actions">
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => copyText(activityToClip(row))}
                >
                  Kopiera
                </button>
                <button
                  type="button"
                  className="linklike small"
                  onClick={() => exclude("activity", row.id, true)}
                >
                  Uteslut
                </button>
              </span>
            </li>
          ))}
        </ul>
        <form className="report-activity-form" onSubmit={addActivity}>
          <select
            value={activity.type}
            onChange={(event) =>
              setActivity((prev) => ({ ...prev, type: event.target.value }))
            }
            aria-label="Typ av aktivitet"
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={activity.occurred_on}
            onChange={(event) =>
              setActivity((prev) => ({
                ...prev,
                occurred_on: event.target.value,
              }))
            }
            aria-label="Datum"
          />
          <input
            value={activity.title}
            onChange={(event) =>
              setActivity((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Titel"
            aria-label="Titel"
          />
          <input
            value={activity.organisation}
            onChange={(event) =>
              setActivity((prev) => ({
                ...prev,
                organisation: event.target.value,
              }))
            }
            placeholder="Organisation"
            aria-label="Organisation"
          />
          <button type="submit" className="small" disabled={busy}>
            Lägg till aktivitet
          </button>
        </form>
      </div>
    </section>
  );
}
