import { useEffect, useMemo, useRef, useState } from "react";

import {
  externalUrl,
  findDuplicateByAdUrl,
  findSimilarByCompanyTitle,
  normalizeAdUrl,
} from "../adUrl.js";
import { request } from "../api.js";
import { STATUSES } from "../statuses.js";
import ModalOverlay from "./ModalOverlay.jsx";

const EMPTY = {
  company: "",
  title: "",
  location: "",
  ad_url: "",
  status: "applied",
  applied_at: new Date().toISOString().slice(0, 10),
  deadline: "",
  contact_name: "",
  contact_info: "",
  next_action_at: "",
  notes: "",
};

// Editor for one tracker row: create when `application` is null,
// otherwise edit + timeline.
export default function ApplicationModal({
  token,
  application,
  existingApplications = [],
  onClose,
  onChanged,
  onOpenExisting,
}) {
  const [form, setForm] = useState(() =>
    application
      ? {
          ...EMPTY,
          ...Object.fromEntries(
            Object.entries(application).map(([k, v]) => [k, v ?? ""])
          ),
        }
      : EMPTY
  );
  const [events, setEvents] = useState(application?.events ?? []);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);
  const adUrl = externalUrl(form.ad_url);
  const duplicateByUrl = useMemo(
    () =>
      findDuplicateByAdUrl(
        existingApplications,
        form.ad_url,
        application?.id ?? null
      ),
    [existingApplications, form.ad_url, application?.id]
  );
  const similarByTitle = useMemo(() => {
    if (duplicateByUrl) return null;
    return findSimilarByCompanyTitle(
      existingApplications,
      form.company,
      form.title,
      application?.id ?? null
    );
  }, [
    duplicateByUrl,
    existingApplications,
    form.company,
    form.title,
    application?.id,
  ]);
  const duplicateBlocked = Boolean(duplicateByUrl);

  useEffect(() => {
    const previous = document.activeElement;
    const focusable = dialogRef.current?.querySelector(
      "input, select, textarea, button"
    );
    focusable?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  const field = (name, type = "text") => ({
    type,
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });

  function payload() {
    const body = { ...form };
    delete body.events;
    delete body.id;
    delete body.posting;
    delete body.status_label;
    delete body.created_at;
    delete body.updated_at;
    body.ad_url = normalizeAdUrl(body.ad_url);
    // Empty strings are not valid dates.
    if (!body.applied_at) body.applied_at = null;
    if (!body.next_action_at) body.next_action_at = null;
    if (!body.deadline) body.deadline = null;
    return body;
  }

  async function save(event) {
    event.preventDefault();
    if (duplicateBlocked) return;
    setError(null);
    try {
      if (application) {
        await request(`/api/v1/applications/${application.id}/`, {
          method: "PATCH",
          token,
          body: payload(),
        });
      } else {
        await request("/api/v1/applications/", {
          method: "POST",
          token,
          body: payload(),
        });
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm("Ta bort den här ansökan från tavlan?")) return;
    await request(`/api/v1/applications/${application.id}/`, {
      method: "DELETE",
      token,
    });
    onChanged();
    onClose();
  }

  async function addEvent(note, occurredAt) {
    const created = await request(
      `/api/v1/applications/${application.id}/events/`,
      { method: "POST", token, body: { note, occurred_at: occurredAt } }
    );
    setEvents([created, ...events]);
    onChanged();
  }

  async function logContactCall() {
    const who = form.contact_name?.trim() || "kontakten";
    await addEvent(
      `Samtal med ${who}`,
      new Date().toISOString().slice(0, 10)
    );
  }

  return (
    <ModalOverlay
      onClose={onClose}
      dialogRef={dialogRef}
      labelledBy="application-modal-title"
    >
      <div className="row-between">
        <h2 id="application-modal-title">
          {application ? form.title || "Ansökan" : "Ny ansökan"}
        </h2>
        <button
          type="button"
          className="secondary small"
          onClick={onClose}
          aria-label="Stäng"
        >
          Stäng ✕
        </button>
      </div>

      <form onSubmit={save}>
        <div className="grid3">
          <label>
            Företag
            <input {...field("company")} required placeholder="Acme AB" />
          </label>
          <label>
            Roll
            <input {...field("title")} required placeholder="Backendutvecklare" />
          </label>
          <label>
            Ort
            <input {...field("location")} />
          </label>
        </div>
        <ContactPanel
          form={form}
          setForm={setForm}
          field={field}
          application={application}
          onLogCall={logContactCall}
        />
        <div className="grid3">
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{ width: "100%" }}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sökt datum
            <input {...field("applied_at", "date")} />
          </label>
          <label>
            Sista ansökningsdag
            <input {...field("deadline", "date")} />
          </label>
        </div>
        <label>
          Nästa steg (datum)
          <input {...field("next_action_at", "date")} />
        </label>
        <label>
          Länk till annonsen
          <div className="input-with-link">
            <input {...field("ad_url", "url")} placeholder="https://…" />
            {adUrl && (
              <a
                className="secondary small input-link-btn"
                href={adUrl}
                target="_blank"
                rel="noreferrer"
              >
                Öppna annons ↗
              </a>
            )}
          </div>
        </label>
        {duplicateByUrl && (
          <p className="warning" role="status">
            Den här annonsen finns redan på tavlan som{" "}
            <button
              type="button"
              className="linklike"
              onClick={() => onOpenExisting?.(duplicateByUrl)}
            >
              {duplicateByUrl.title} @ {duplicateByUrl.company}
            </button>
            .
          </p>
        )}
        {similarByTitle && (
          <p className="warning warning--soft" role="status">
            Du har redan en ansökan med samma företag och roll:{" "}
            <button
              type="button"
              className="linklike"
              onClick={() => onOpenExisting?.(similarByTitle)}
            >
              {similarByTitle.title} @ {similarByTitle.company}
            </button>
            . Kontrollera att det inte är samma jobb.
          </p>
        )}
        <label>
          Anteckningar
          <textarea {...field("notes")} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row-between">
          <button disabled={duplicateBlocked}>
            {application ? "Spara" : "Lägg till"}
          </button>
          {application && (
            <button type="button" className="danger small" onClick={remove}>
              Ta bort
            </button>
          )}
        </div>
      </form>

      {application && <Timeline events={events} onAdd={addEvent} />}
    </ModalOverlay>
  );
}

function parseContactInfo(info) {
  const trimmed = info?.trim() || "";
  if (!trimmed) return {};
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { email: trimmed };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7 && /^[\d\s+\-().]+$/.test(trimmed)) {
    return { phone: trimmed };
  }
  return { raw: trimmed };
}

function ContactPanel({ form, setForm, field, application, onLogCall }) {
  const links = parseContactInfo(form.contact_info);
  const hasContact = Boolean(form.contact_name?.trim() || form.contact_info?.trim());

  return (
    <section className="contact-panel">
      <div className="contact-panel-head">
        <div>
          <h3>Kontakt</h3>
          <p className="muted">
            Rekryterare, chef eller HR — snabb åtkomst när det är dags att följa upp.
          </p>
        </div>
        {application && hasContact && (
          <button
            type="button"
            className="secondary small"
            onClick={onLogCall}
          >
            Logga samtal
          </button>
        )}
      </div>
      <div className="grid2">
        <label>
          Kontaktperson
          <input {...field("contact_name")} placeholder="Rekryterare, chef…" />
        </label>
        <label>
          Kontaktuppgift
          <input {...field("contact_info")} placeholder="E-post eller telefon" />
        </label>
      </div>
      {hasContact && (
        <div className="contact-panel-actions">
          {links.email && (
            <a className="secondary small" href={`mailto:${links.email}`}>
              Maila {form.contact_name?.trim() || links.email}
            </a>
          )}
          {links.phone && (
            <a
              className="secondary small"
              href={`tel:${links.phone.replace(/\s/g, "")}`}
            >
              Ring {form.contact_name?.trim() || links.phone}
            </a>
          )}
          {links.raw && !links.email && !links.phone && (
            <span className="muted">{links.raw}</span>
          )}
          {form.contact_name && form.contact_info && (
            <button
              type="button"
              className="linklike small"
              onClick={() =>
                setForm({
                  ...form,
                  notes: [form.notes, `Kontakt: ${form.contact_name} (${form.contact_info})`]
                    .filter(Boolean)
                    .join("\n"),
                })
              }
            >
              Kopiera till anteckningar
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Timeline({ events, onAdd }) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setError(null);
    try {
      await onAdd(note.trim(), date);
      setNote("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h3>Tidslinje</h3>
      <form className="timeline-form" onSubmit={submit}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="t.ex. Telefonintervju med rekryteraren"
        />
        <button className="small">Logga</button>
      </form>
      {error && <p className="error">{error}</p>}
      {events.length === 0 ? (
        <p className="muted">
          Inga händelser ännu — statusbyten loggas automatiskt.
        </p>
      ) : (
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <span className="muted">{e.occurred_at}</span> {e.note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
