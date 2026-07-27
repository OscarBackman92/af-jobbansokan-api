import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  externalUrl,
  findDuplicateByAdUrl,
  findSimilarByCompanyTitle,
  linkLabel,
  normalizeAdUrl,
  platsbankenJobId,
} from "../adUrl.js";
import { request } from "../api.js";
import { localISODate } from "../localDate.js";
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
  source: "",
  applied_at: localISODate(),
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
  const initialFormRef = useRef(JSON.stringify(form));
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
  const duplicateBlocked = Boolean(
    duplicateByUrl || (similarByTitle && !application)
  );

  const requestClose = useCallback(() => {
    if (
      JSON.stringify(form) !== initialFormRef.current &&
      !window.confirm("Du har osparade ändringar. Stäng utan att spara?")
    ) {
      return;
    }
    onClose();
  }, [form, onClose]);

  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  // List rows are lean (no timeline); fetch the full row when editing.
  useEffect(() => {
    if (!applicationId) return undefined;
    let cancelled = false;
    request(`/api/v1/applications/${applicationId}/`, { token })
      .then((detail) => {
        if (cancelled) return;
        setEvents(detail.events ?? []);
        setForm((prev) => {
          const next = {
            ...prev,
            ad_description: detail.ad_description || prev.ad_description,
            apply_url: detail.apply_url || prev.apply_url,
            source_job_id: detail.source_job_id || prev.source_job_id,
          };
          initialFormRef.current = JSON.stringify(next);
          return next;
        });
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
        setForm((prev) => {
          const next = {
            ...prev,
            ad_description: snapshot.ad_description || prev.ad_description,
            apply_url: prev.apply_url || snapshot.apply_url,
            source_job_id: prev.source_job_id || snapshot.source_job_id,
            ad_url: prev.ad_url || job.webpage_url || "",
          };
          initialFormRef.current = JSON.stringify(next);
          return next;
        });
        if (snapshot.ad_description || snapshot.apply_url) {
          const body = {};
          if (snapshot.ad_description) body.ad_description = snapshot.ad_description;
          const apply = externalUrl(snapshot.apply_url);
          if (apply) body.apply_url = apply;
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

  // Focus once on open — never re-run on form keystrokes (that stole focus).
  useEffect(() => {
    const previous = document.activeElement;
    const root = dialogRef.current;
    const prefer =
      root?.querySelector("#app-field-company") ||
      root?.querySelector(".modal-close");
    prefer?.focus({ preventScroll: true });

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, []);

  const field = (name, type = "text") => ({
    id: `app-field-${name}`,
    type,
    value: form[name],
    onChange: (e) => setForm((prev) => ({ ...prev, [name]: e.target.value })),
  });

  function payload() {
    const body = { ...form };
    delete body.events;
    delete body.id;
    delete body.posting;
    delete body.status_label;
    delete body.match;
    delete body.last_activity_at;
    delete body.reached_interview;
    delete body.created_at;
    delete body.updated_at;
    body.ad_url = normalizeAdUrl(body.ad_url);
    body.apply_url = externalUrl(body.apply_url) || "";
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
      onClose={requestClose}
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
            onClick={requestClose}
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
          <details className="application-form-toggle" open>
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
              requestClose={requestClose}
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
              requestClose={requestClose}
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
  requestClose,
  setForm,
  similarByTitle,
  showLinkFields,
}) {
  return (
    <>
      <label htmlFor="app-field-company">
        Företag *
        <input {...field("company")} required placeholder="Acme AB" />
      </label>
      <div className="grid2">
        <label htmlFor="app-field-title">
          Roll *
          <input {...field("title")} required placeholder="Backendutvecklare" />
        </label>
        <label htmlFor="app-field-location">
          Ort
          <input {...field("location")} placeholder="Stockholm" />
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
        <label htmlFor="app-field-status">
          Status
          <select
            id="app-field-status"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value }))
            }
            style={{ width: "100%" }}
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="app-field-source">
          Källa
          <select
            id="app-field-source"
            value={form.source}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, source: e.target.value }))
            }
            style={{ width: "100%" }}
          >
            <option value="">—</option>
            <option value="linkedin">LinkedIn</option>
            <option value="platsbanken">Platsbanken</option>
            <option value="company">Företagets sida</option>
            <option value="recruiter">Rekryterare</option>
            <option value="other">Annat</option>
          </select>
        </label>
        <label htmlFor="app-field-applied_at">
          Sökt datum
          <input {...field("applied_at", "date")} />
        </label>
      </div>
      <div className="grid2">
        <label htmlFor="app-field-deadline">
          Sista ansökningsdag
          <input {...field("deadline", "date")} />
        </label>
        <label htmlFor="app-field-next_action_at">
          Nästa steg (datum)
          <input {...field("next_action_at", "date")} />
        </label>
      </div>
      {showLinkFields && (
        <details className="link-details">
          <summary>Redigera länkar</summary>
          <label htmlFor="app-field-apply_url">
            Länk till ansökan
            <input
              {...field("apply_url", "url")}
              placeholder="Arbetsgivarens ansökningssida"
            />
          </label>
          <label htmlFor="app-field-ad_url">
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
        <p
          className={application ? "warning warning--soft" : "warning"}
          role="status"
        >
          Du har redan en ansökan med samma företag och roll:{" "}
          <button
            type="button"
            className="linklike"
            onClick={() => onOpenExisting?.(similarByTitle)}
          >
            {similarByTitle.title} @ {similarByTitle.company}
          </button>
          .
          {application
            ? " Kontrollera att det inte är samma jobb."
            : " Öppna den befintliga ansökan istället."}
        </p>
      )}
      <label htmlFor="app-field-notes">
        Anteckningar
        <textarea {...field("notes")} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row-between">
        <div className="row">
          <button disabled={duplicateBlocked}>
            {application ? "Spara" : "Lägg till"}
          </button>
          <button type="button" className="secondary" onClick={requestClose}>
            Avbryt
          </button>
        </div>
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
        <label htmlFor="app-field-contact_name">
          Kontaktperson
          <input {...field("contact_name")} placeholder="Rekryterare, chef…" />
        </label>
        <label htmlFor="app-field-contact_info">
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
