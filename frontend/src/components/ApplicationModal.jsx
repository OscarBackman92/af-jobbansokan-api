import { useEffect, useMemo, useRef, useState } from "react";

import {
  externalUrl,
  findDuplicateByAdUrl,
  findSimilarByCompanyTitle,
  linkLabel,
  normalizeAdUrl,
  platsbankenJobId,
} from "../adUrl.js";
import { request } from "../api.js";
import { STATUSES } from "../statuses.js";
import ModalOverlay from "./ModalOverlay.jsx";

const EMPTY = {
  company: "",
  title: "",
  location: "",
  ad_url: "",
  apply_url: "",
  ad_description: "",
  source_job_id: "",
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
  const [adLoading, setAdLoading] = useState(false);
  const [adFetchError, setAdFetchError] = useState(null);
  const dialogRef = useRef(null);
  const platsbankenHref = externalUrl(form.ad_url);
  const applyHref = externalUrl(form.apply_url) || platsbankenHref;
  const applicationId = application?.id ?? null;
  const previewDescription = form.ad_description?.trim();
  const jobId = form.source_job_id || platsbankenJobId(form.ad_url);
  const duplicateByUrl = useMemo(
    () => findDuplicateByAdUrl(existingApplications, form.ad_url, applicationId),
    [existingApplications, form.ad_url, applicationId]
  );
  const similarByTitle = useMemo(() => {
    if (duplicateByUrl) return null;
    return findSimilarByCompanyTitle(
      existingApplications,
      form.company,
      form.title,
      applicationId
    );
  }, [
    duplicateByUrl,
    existingApplications,
    form.company,
    form.title,
    applicationId,
  ]);
  const duplicateBlocked = Boolean(duplicateByUrl);

  // List rows are lean (no timeline); fetch the full row when editing.
  useEffect(() => {
    if (!applicationId) return undefined;
    let cancelled = false;
    request(`/api/v1/applications/${applicationId}/`, { token })
      .then((detail) => {
        if (cancelled) return;
        setEvents(detail.events ?? []);
        setForm((prev) => ({
          ...prev,
          ad_description: detail.ad_description || prev.ad_description,
          apply_url: detail.apply_url || prev.apply_url,
          source_job_id: detail.source_job_id || prev.source_job_id,
        }));
      })
      .catch(() => {
        /* timeline stays empty; the form is still usable */
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, token]);

  // Older rows may lack a saved ad snapshot — pull it from Platsbanken on open.
  useEffect(() => {
    if (!applicationId || previewDescription || !jobId) return undefined;
    let cancelled = false;
    setAdLoading(true);
    setAdFetchError(null);
    request(`/api/v1/jobs/${jobId}/`, { token })
      .then(async (job) => {
        if (cancelled) return;
        const snapshot = {
          ad_description: job.description || "",
          apply_url: job.application_url || "",
          source_job_id: job.id || "",
        };
        setForm((prev) => ({
          ...prev,
          ad_description: snapshot.ad_description || prev.ad_description,
          apply_url: prev.apply_url || snapshot.apply_url,
          source_job_id: prev.source_job_id || snapshot.source_job_id,
          ad_url: prev.ad_url || job.webpage_url || "",
        }));
        if (snapshot.ad_description || snapshot.apply_url) {
          const body = {};
          if (snapshot.ad_description) body.ad_description = snapshot.ad_description;
          if (snapshot.apply_url) body.apply_url = normalizeAdUrl(snapshot.apply_url);
          if (snapshot.source_job_id) body.source_job_id = snapshot.source_job_id;
          try {
            await request(`/api/v1/applications/${applicationId}/`, {
              method: "PATCH",
              token,
              body,
            });
          } catch {
            /* preview still works; user can save manually */
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setAdFetchError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAdLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, jobId, previewDescription, token]);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current
      ?.querySelector(".modal-close")
      ?.focus({ preventScroll: true });

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
    delete body.match;
    delete body.created_at;
    delete body.updated_at;
    body.ad_url = normalizeAdUrl(body.ad_url);
    body.apply_url = normalizeAdUrl(body.apply_url);
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
    if (!window.confirm("Ta bort den här ansökan permanent?")) return;
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
      className="modal application-modal"
      overlayClassName="overlay overlay--application"
      dialogRef={dialogRef}
      labelledBy="application-modal-title"
    >
      <header className="application-modal-header">
        <div className="modal-head">
          <div className="modal-head-text">
            <h2 id="application-modal-title">
              {application ? form.title || "Ansökan" : "Ny ansökan"}
            </h2>
            {application && (
              <p className="muted">
                {form.company}
                {form.location && ` — ${form.location}`}
                {form.deadline && ` · sista ansökningsdag ${form.deadline}`}
              </p>
            )}
          </div>
          <button
            type="button"
            className="secondary small modal-close"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        {application && (
          <div className="application-ad-toolbar">
            <div className="modal-actions">
              {applyHref && (
                <a
                  className="btn-primary"
                  href={applyHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {form.apply_url ? "Ansök hos arbetsgivaren ↗" : "Öppna annons ↗"}
                </a>
              )}
              {platsbankenHref && platsbankenHref !== applyHref && (
                <a
                  className="secondary"
                  href={platsbankenHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Platsbanken ↗
                </a>
              )}
            </div>
            {(form.apply_url || form.ad_url) && (
              <p className="muted application-link-labels">
                {form.apply_url && (
                  <span>Ansökan: {linkLabel(form.apply_url)}</span>
                )}
                {form.apply_url && form.ad_url && platsbankenHref !== applyHref && (
                  <span aria-hidden="true"> · </span>
                )}
                {form.ad_url && platsbankenHref !== applyHref && (
                  <span>Platsbanken: {linkLabel(form.ad_url)}</span>
                )}
              </p>
            )}
          </div>
        )}
      </header>

      <div className="application-modal-body">
      {application && (
        <section className="application-ad" aria-labelledby="application-ad-heading">
          <h3 id="application-ad-heading">Om jobbet</h3>
          {adLoading && !previewDescription && (
            <p className="muted application-ad-status" role="status">
              Hämtar annonstext…
            </p>
          )}
          {adFetchError && (
            <p className="warning" role="status">
              Kunde inte hämta annonstexten: {adFetchError}
            </p>
          )}
          <div className="description application-ad-text">
            {previewDescription ||
              (adLoading
                ? ""
                : "Ingen annonstext sparad ännu.")}
          </div>
          {!previewDescription && !adLoading && jobId && (
            <button
              type="button"
              className="secondary small"
              onClick={() =>
                setForm((prev) => ({ ...prev, ad_description: "" }))
              }
            >
              Hämta annons igen
            </button>
          )}
        </section>
      )}

      <form className="application-form" onSubmit={save}>
        {application ? (
          <details className="application-form-toggle">
            <summary>Dina uppgifter</summary>
            <ApplicationFields
              application={application}
              duplicateByUrl={duplicateByUrl}
              duplicateBlocked={duplicateBlocked}
              error={error}
              field={field}
              form={form}
              onLogCall={logContactCall}
              onOpenExisting={onOpenExisting}
              onRemove={remove}
              setForm={setForm}
              similarByTitle={similarByTitle}
              showLinkFields
            />
          </details>
        ) : (
          <>
            <h3>Dina uppgifter</h3>
            <ApplicationFields
              application={application}
              duplicateByUrl={duplicateByUrl}
              duplicateBlocked={duplicateBlocked}
              error={error}
              field={field}
              form={form}
              onLogCall={logContactCall}
              onOpenExisting={onOpenExisting}
              onRemove={remove}
              setForm={setForm}
              similarByTitle={similarByTitle}
              showLinkFields
            />
          </>
        )}
      </form>

      {application && <Timeline events={events} onAdd={addEvent} />}
      </div>
    </ModalOverlay>
  );
}

function ApplicationFields({
  application,
  duplicateBlocked,
  duplicateByUrl,
  error,
  field,
  form,
  onLogCall,
  onOpenExisting,
  onRemove,
  setForm,
  similarByTitle,
  showLinkFields,
}) {
  return (
    <>
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
        onLogCall={onLogCall}
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
      {showLinkFields && (
        <details className="link-details">
          <summary>Redigera länkar</summary>
          <label>
            Länk till ansökan
            <input
              {...field("apply_url", "url")}
              placeholder="Arbetsgivarens ansökningssida"
            />
          </label>
          <label>
            Platsbanken-referens
            <input
              {...field("ad_url", "url")}
              placeholder="https://arbetsformedlingen.se/platsbanken/annonser/…"
            />
          </label>
        </details>
      )}
      {duplicateByUrl && (
        <p className="warning" role="status">
            Den här annonsen finns redan bland dina ansökningar som{" "}
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
          <button type="button" className="danger small" onClick={onRemove}>
            Ta bort
          </button>
        )}
      </div>
    </>
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
    <section className="timeline-section">
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
    </section>
  );
}
