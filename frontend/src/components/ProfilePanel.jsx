import { useCallback, useEffect, useRef, useState } from "react";

import { request } from "../api.js";
import EvidenceRow, { ManualEvidenceAdd } from "./EvidenceEditor.jsx";
import JobProfileSelector from "./JobProfileSelector.jsx";
import ModalOverlay from "./ModalOverlay.jsx";
import {
  activeProfile,
  addEvidence,
  addProfile,
  anyProfileHasEvidence,
  applyEvidenceToProfiles,
  confirmedEvidence,
  countSuggestions,
  educationSourceLabel,
  evidenceForSource,
  evidenceByLabel,
  experienceSourceLabel,
  groupEvidenceBySource,
  normalizeJobProfiles,
  removeEvidence,
  removeSuggestion,
  setActiveProfile,
  updateProfileLabel,
} from "../jobProfiles.js";
import { getMarketHints } from "../marketHints.js";

function UnsavedChangesDialog({ message, onCancel, onDiscard }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onCancel]);

  return (
    <ModalOverlay
      onClose={onCancel}
      className="modal confirm-modal"
      dialogRef={dialogRef}
      labelledBy="unsaved-changes-title"
    >
      <h2 id="unsaved-changes-title">Osparade ändringar</h2>
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Fortsätt redigera
        </button>
        <button type="button" className="danger" onClick={onDiscard}>
          Kasta ändringar
        </button>
      </div>
    </ModalOverlay>
  );
}

export default function ProfilePanel({ token, me, onMeChange, onLogout, profileLeaveGuardRef }) {
  return (
    <div className="stack">
      <ProfileCard
        token={token}
        me={me}
        onMeChange={onMeChange}
        onLogout={onLogout}
      />
      <ResumeCard token={token} profileLeaveGuardRef={profileLeaveGuardRef} />
    </div>
  );
}

function ProfileCard({ token, me, onMeChange, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "" });
  const [message, setMessage] = useState(null);

  if (!me) {
    return (
      <div className="card">
        <div className="loading-row">
          <span className="spinner" /> Laddar profil…
        </div>
      </div>
    );
  }

  function startEdit() {
    setForm({
      email: me.email,
      first_name: me.first_name,
      last_name: me.last_name,
    });
    setMessage(null);
    setEditing(true);
  }

  async function save(event) {
    event.preventDefault();
    try {
      const updated = await request("/api/v1/me/", {
        method: "PATCH",
        token,
        body: form,
      });
      onMeChange(updated);
      setEditing(false);
      setMessage("✓ Profilen är sparad.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function deleteAccount() {
    const sure = window.confirm(
      "Radera kontot permanent? Alla dina ansökningar och allt annat tas bort."
    );
    if (!sure) return;
    await request("/api/v1/me/", { method: "DELETE", token });
    onLogout();
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });

  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
  const initial = (me.first_name || me.email || "?").trim().charAt(0).toUpperCase();

  return (
    <section className="card">
      <div className="row-between profile-head">
        <div className="profile-id">
          <div className="avatar" aria-hidden="true">
            {initial}
          </div>
          <div>
            <h2>{fullName || "Min profil"}</h2>
            <p className="muted">{me.email}</p>
          </div>
        </div>
        <div className="row-gap">
          <button
            className="secondary small"
            onClick={editing ? () => setEditing(false) : startEdit}
          >
            {editing ? "Avbryt" : "Redigera"}
          </button>
        </div>
      </div>
      {message && <p className="notice">{message}</p>}
      {editing && (
        <form onSubmit={save}>
          <div className="grid3">
            <label>
              Förnamn
              <input {...field("first_name")} />
            </label>
            <label>
              Efternamn
              <input {...field("last_name")} />
            </label>
            <label>
              E-post
              <input type="email" {...field("email")} />
            </label>
          </div>
          <div className="row-between">
            <button>Spara</button>
            <button type="button" className="danger small" onClick={deleteAccount}>
              Radera konto permanent
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const EMPTY_RESUME = {
  headline: "",
  summary: "",
  skills: [],
  experience: [],
  education: [],
  job_profiles: [],
};

function hasCvContent(resume, jobProfiles) {
  return (
    resume.headline ||
    resume.summary ||
    anyProfileHasEvidence(jobProfiles) ||
    resume.experience.length ||
    resume.education.length
  );
}

function CvReadView({ resume, jobProfiles }) {
  const profiles = normalizeJobProfiles(jobProfiles, resume.headline);
  const profile = activeProfile(profiles);
  const evidence = confirmedEvidence(profile);
  const hasContent = hasCvContent(resume, profiles);

  if (!hasContent) {
    return (
      <p className="muted">
        Inget CV inlagt än. Ladda upp en fil eller klicka Redigera.
      </p>
    );
  }

  const bySource = groupEvidenceBySource(profile);

  return (
    <div className="cv-read">
      <p className="cv-profile-label">
        Aktiv profil: <strong>{profile.label}</strong>
      </p>
      {resume.headline && <p className="cv-headline">{resume.headline}</p>}
      {resume.summary && <p className="muted">{resume.summary}</p>}

      {evidence.length > 0 && (
        <>
          <h3>Kompetenser du markerat</h3>
          {[...bySource.entries()].map(([sourceLabel, items]) => (
            <div className="cv-evidence-group" key={sourceLabel}>
              <p className="muted cv-evidence-source">{items[0]?.source?.label || sourceLabel}</p>
              <div className="cv-skills">
                {items.map((item) => (
                  <span className="badge badge--skill-domain" key={item.id}>
                    {item.term}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {resume.experience.length > 0 && (
        <>
          <h3>Erfarenhet</h3>
          <ul className="cv-list">
            {resume.experience.map((row, i) => (
              <li key={i}>
                <div className="cv-row-head">
                  <strong>{row.title}</strong>
                  {row.company && <span> · {row.company}</span>}
                  {row.years && <span className="muted"> · {row.years}</span>}
                </div>
                {row.description && (
                  <p className="muted cv-desc">{row.description}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {resume.education.length > 0 && (
        <>
          <h3>Utbildning</h3>
          <ul className="cv-list">
            {resume.education.map((row, i) => (
              <li key={i}>
                <strong>{row.degree || row.school}</strong>
                {row.degree && row.school && <span> · {row.school}</span>}
                {row.years && <span className="muted"> · {row.years}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ResumeCard({ token, profileLeaveGuardRef }) {
  const [resume, setResume] = useState(EMPTY_RESUME);
  const [jobProfiles, setJobProfiles] = useState(() => normalizeJobProfiles([]));
  const [savedResume, setSavedResume] = useState(EMPTY_RESUME);
  const [savedJobProfiles, setSavedJobProfiles] = useState(() => normalizeJobProfiles([]));
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveState, setSaveState] = useState("clean");
  const [evidenceSuggestions, setEvidenceSuggestions] = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [marketHints, setMarketHints] = useState([]);
  const [unsavedPrompt, setUnsavedPrompt] = useState(null);

  const active = activeProfile(jobProfiles);

  function revertEdits() {
    setResume(savedResume);
    setJobProfiles(savedJobProfiles);
    setSaveState("clean");
  }

  const requestDiscard = useCallback(
    (message, onProceed) => {
      if (!open || saveState !== "dirty") {
        onProceed();
        return;
      }
      setUnsavedPrompt({
        message,
        onDiscard: () => {
          revertEdits();
          setUnsavedPrompt(null);
          onProceed();
        },
      });
    },
    [open, saveState, savedResume, savedJobProfiles]
  );

  useEffect(() => {
    setLoading(true);
    request("/api/v1/me/resume/", { token })
      .then((data) => {
        const profiles = normalizeJobProfiles(data.job_profiles, data.headline);
        setResume(data);
        setJobProfiles(profiles);
        setSavedResume(data);
        setSavedJobProfiles(profiles);
        setSaveState("clean");
      })
      .catch((err) => setMessage({ tone: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!open) return undefined;
    setMarketHints(getMarketHints(confirmedEvidence(active).map((item) => item.term)));

    const hasText =
      resume.experience.some((row) => row.description?.trim() || row.title?.trim()) ||
      resume.education.some((row) => row.degree?.trim() || row.school?.trim());
    if (!hasText) {
      setEvidenceSuggestions(null);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const data = await request("/api/v1/me/resume/suggest-evidence/", {
          method: "POST",
          token,
          body: {
            headline: resume.headline,
            experience: resume.experience,
            education: resume.education,
            job_profiles: jobProfiles,
            active_profile_id: active.id,
          },
        });
        if (!cancelled) setEvidenceSuggestions(data.by_source);
      } catch {
        if (!cancelled) setEvidenceSuggestions(null);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, resume.experience, resume.education, resume.headline, jobProfiles, active.id, token]);

  useEffect(() => {
    if (!profileLeaveGuardRef) return undefined;
    profileLeaveGuardRef.current = (proceed) => {
      requestDiscard(
        "Du har osparade ändringar i CV:t. Lämna sidan utan att spara?",
        proceed
      );
    };
    return () => {
      profileLeaveGuardRef.current = null;
    };
  }, [profileLeaveGuardRef, requestDiscard]);

  function toggleEditor() {
    setMessage(null);
    if (open) {
      requestDiscard(
        "Du har osparade ändringar i CV:t. Stäng utan att spara?",
        () => setOpen(false)
      );
      return;
    }
    setOpen(true);
  }

  function setField(name, value) {
    setSaveState("dirty");
    setResume((current) => ({ ...current, [name]: value }));
  }

  function mutateProfiles(updater) {
    setSaveState("dirty");
    setJobProfiles((current) => updater(current));
  }

  function addEvidenceItem(source, item) {
    mutateProfiles((profiles) =>
      applyEvidenceToProfiles(profiles, active.id, (profile) =>
        addEvidence(profile, {
          term: item.term,
          category: item.category,
          source,
        })
      )
    );
    const sourceKey =
      source.type === "experience"
        ? `experience:${source.index}`
        : source.type === "education"
          ? `education:${source.index}`
          : "cv_section";
    setEvidenceSuggestions((current) => removeSuggestion(current, sourceKey, item.term));
  }

  function removeEvidenceItem(term) {
    mutateProfiles((profiles) =>
      applyEvidenceToProfiles(profiles, active.id, (profile) => removeEvidence(profile, term))
    );
  }

  function dismissSuggestion(sourceKey, term) {
    setEvidenceSuggestions((current) => removeSuggestion(current, sourceKey, term));
  }

  function setRow(listName, index, key, value) {
    setSaveState("dirty");
    setResume((current) => {
      const rows = current[listName].map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      );
      return { ...current, [listName]: rows };
    });
  }

  function addRow(listName, emptyRow) {
    setSaveState("dirty");
    setResume((current) => ({
      ...current,
      [listName]: [...current[listName], emptyRow],
    }));
  }

  function removeRow(listName, index) {
    setSaveState("dirty");
    setResume((current) => ({
      ...current,
      [listName]: current[listName].filter((_, i) => i !== index),
    }));
  }

  async function upload(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const draft = await request("/api/v1/me/resume/parse/", {
        method: "POST",
        token,
        body: form,
      });
      setResume((current) => ({
        ...current,
        headline: draft.headline || current.headline,
        summary: draft.summary || current.summary,
        experience: draft.experience.length
          ? draft.experience
          : current.experience,
        education: draft.education.length ? draft.education : current.education,
      }));
      if (draft.evidence_suggestions) {
        setEvidenceSuggestions(draft.evidence_suggestions);
      }
      setOpen(true);
      setSaveState("dirty");
      setMessage({
        tone: "info",
        text:
          "CV:t är inläst — kolla att erfarenheten stämmer och markera vad som ska räknas. " +
          "Filen sparas aldrig på servern.",
      });
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    }
  }

  async function save(event) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const saved = await request("/api/v1/me/resume/", {
        method: "PUT",
        token,
        body: {
          ...resume,
          job_profiles: jobProfiles,
        },
      });
      const profiles = normalizeJobProfiles(saved.job_profiles, saved.headline);
      setResume(saved);
      setJobProfiles(profiles);
      setSavedResume(saved);
      setSavedJobProfiles(profiles);
      setSaveState("clean");
      setOpen(false);
      setMessage({ tone: "success", text: "CV:t är sparat." });
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteResume() {
    const sure = window.confirm(
      "Radera allt CV-innehåll? Detta går inte att ångra."
    );
    if (!sure) return;
    setMessage(null);
    setDeleting(true);
    try {
      await request("/api/v1/me/resume/", { method: "DELETE", token });
      setResume(EMPTY_RESUME);
      setJobProfiles(normalizeJobProfiles([]));
      setSavedResume(EMPTY_RESUME);
      setSavedJobProfiles(normalizeJobProfiles([]));
      setSaveState("clean");
      setOpen(false);
      setMessage({ tone: "success", text: "CV:t är raderat." });
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setDeleting(false);
    }
  }

  const cvHasContent = hasCvContent(resume, jobProfiles);

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Mitt CV</h2>
          <p className="muted">
            Markera vad i CV:t som stämmer — det styr hur annonser matchas.
          </p>
        </div>
        <div className="row-gap">
          <label className="upload-button">
            Ladda upp CV (PDF/DOCX/TXT)
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={upload}
              hidden
            />
          </label>
          <button className="secondary small" onClick={toggleEditor}>
            {open ? "Stäng" : "Redigera"}
          </button>
        </div>
      </div>
      {message && (
        <p
          className={message.tone === "error" ? "error" : "notice"}
          role="status"
        >
          {message.tone === "success" && (
            <span className="notice-check" aria-hidden="true">
              ✓
            </span>
          )}
          {message.text}
        </p>
      )}
      {loading && (
        <div className="loading-row">
          <span className="spinner" /> Laddar CV…
        </div>
      )}
      {!loading && !open && (
        <CvReadView resume={resume} jobProfiles={jobProfiles} />
      )}
      {!loading && open && (
        <form onSubmit={save}>
          <p className="muted cv-edit-hint">
            Varje block under Erfarenhet och Utbildning är en rad i CV:t.
            Knappen &quot;Ta bort rad&quot; tar bort just den raden — inte hela
            CV:t.
          </p>
          <label>
            Rubrik
            <input
              value={resume.headline}
              onChange={(e) => setField("headline", e.target.value)}
              placeholder="t.ex. Backendutvecklare med fem års erfarenhet"
            />
          </label>
          <label>
            Sammanfattning
            <textarea
              value={resume.summary}
              onChange={(e) => setField("summary", e.target.value)}
            />
          </label>
          <JobProfileSelector
            profiles={jobProfiles}
            activeId={active.id}
            onSelect={(id) => mutateProfiles((profiles) => setActiveProfile(profiles, id))}
            onAdd={() => {
              const label = window.prompt("Namn på ny profil", `Profil ${jobProfiles.length + 1}`);
              if (!label?.trim()) return;
              mutateProfiles((profiles) => addProfile(profiles, label.trim()));
            }}
            onRename={(id, label) =>
              mutateProfiles((profiles) => updateProfileLabel(profiles, id, label))
            }
          />

          {marketHints.length > 0 && (
            <section className="market-hints" aria-live="polite">
              <h3>Populärt i jobb du tittat på</h3>
              <p className="muted">Förekom ofta i annonser du tittat på — lägg till om det stämmer.</p>
              <div className="evidence-suggestions">
                {marketHints.map((item) => (
                  <span className="evidence-suggestion" key={item.term}>
                    <button
                      type="button"
                      onClick={() =>
                        addEvidenceItem(
                          { type: "manual", index: null, label: "Från annonser du tittat på" },
                          item
                        )
                      }
                    >
                      + {item.term}
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}

          {suggestionsLoading && (
            <p className="muted">
              <span className="spinner" /> Läser CV:t…
            </p>
          )}

          {!suggestionsLoading && countSuggestions(evidenceSuggestions) > 0 && (
            <EvidenceRow
              title="CV: kompetenssektion"
              evidence={evidenceByLabel(active, "CV: kompetenssektion")}
              suggestions={evidenceSuggestions?.cv_section ?? []}
              onAddSuggestion={(item) =>
                addEvidenceItem(
                  { type: "manual", index: null, label: "CV: kompetenssektion" },
                  item
                )
              }
              onDismissSuggestion={(term) => dismissSuggestion("cv_section", term)}
              onRemoveEvidence={removeEvidenceItem}
            />
          )}

          <ManualEvidenceAdd
            onAdd={(item) =>
              addEvidenceItem({ type: "manual", index: null, label: "Manuellt tillagd" }, item)
            }
          />

          <h3>Erfarenhet</h3>
          {resume.experience.map((row, i) => (
            <fieldset className="resume-entry" key={i}>
              <legend>Erfarenhet {i + 1}</legend>
              <div className="resume-fields">
                <label>
                  Arbetstitel
                  <input
                    value={row.title}
                    onChange={(e) =>
                      setRow("experience", i, "title", e.target.value)
                    }
                    placeholder="t.ex. Backendutvecklare"
                  />
                </label>
                <label>
                  Arbetsgivare
                  <input
                    value={row.company}
                    onChange={(e) =>
                      setRow("experience", i, "company", e.target.value)
                    }
                    placeholder="t.ex. Acme AB"
                  />
                </label>
                <label>
                  Period
                  <input
                    value={row.years}
                    onChange={(e) =>
                      setRow("experience", i, "years", e.target.value)
                    }
                    placeholder="t.ex. 2020–2024"
                  />
                </label>
              </div>
              <label>
                Beskrivning
                <textarea
                  className="resume-description"
                  value={row.description || ""}
                  onChange={(e) =>
                    setRow("experience", i, "description", e.target.value)
                  }
                  placeholder="Kort beskrivning, ansvar eller resultat"
                />
              </label>
              <EvidenceRow
                title="Bevis från denna rad"
                evidence={evidenceForSource(active, `experience:${i}`)}
                suggestions={evidenceSuggestions?.[`experience:${i}`] ?? []}
                onAddSuggestion={(item) =>
                  addEvidenceItem(
                    {
                      type: "experience",
                      index: i,
                      label: experienceSourceLabel(i, row),
                    },
                    item
                  )
                }
                onDismissSuggestion={(term) => dismissSuggestion(`experience:${i}`, term)}
                onRemoveEvidence={removeEvidenceItem}
              />
              <button
                type="button"
                className="danger small"
                onClick={() => removeRow("experience", i)}
                aria-label={`Ta bort erfarenhet ${i + 1}`}
              >
                Ta bort rad
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="secondary small"
            onClick={() =>
              addRow("experience", {
                title: "",
                company: "",
                years: "",
                description: "",
              })
            }
          >
            + Lägg till erfarenhet
          </button>

          <h3>Utbildning</h3>
          {resume.education.map((row, i) => (
            <fieldset className="resume-entry" key={i}>
              <legend>Utbildning {i + 1}</legend>
              <div className="resume-fields">
                <label>
                  Lärosäte
                  <input
                    value={row.school}
                    onChange={(e) =>
                      setRow("education", i, "school", e.target.value)
                    }
                    placeholder="t.ex. KTH"
                  />
                </label>
                <label>
                  Examen / inriktning
                  <input
                    value={row.degree}
                    onChange={(e) =>
                      setRow("education", i, "degree", e.target.value)
                    }
                    placeholder="t.ex. Civilingenjör datateknik"
                  />
                </label>
                <label>
                  Period
                  <input
                    value={row.years}
                    onChange={(e) =>
                      setRow("education", i, "years", e.target.value)
                    }
                    placeholder="t.ex. 2016–2020"
                  />
                </label>
              </div>
              <EvidenceRow
                title="Bevis från utbildningen"
                evidence={evidenceForSource(active, `education:${i}`)}
                suggestions={evidenceSuggestions?.[`education:${i}`] ?? []}
                onAddSuggestion={(item) =>
                  addEvidenceItem(
                    {
                      type: "education",
                      index: i,
                      label: educationSourceLabel(i, row),
                    },
                    item
                  )
                }
                onDismissSuggestion={(term) => dismissSuggestion(`education:${i}`, term)}
                onRemoveEvidence={removeEvidenceItem}
              />
              <button
                type="button"
                className="danger small"
                onClick={() => removeRow("education", i)}
                aria-label={`Ta bort utbildning ${i + 1}`}
              >
                Ta bort rad
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="secondary small"
            onClick={() => addRow("education", { school: "", degree: "", years: "" })}
          >
            + Lägg till utbildning
          </button>

          {cvHasContent && (
            <div className="danger-zone">
              <h3>Radera CV</h3>
              <p className="muted">
                Tar bort allt sparat CV-innehåll permanent. Detta går inte att ångra.
              </p>
              <button
                type="button"
                className="danger small"
                onClick={deleteResume}
                disabled={deleting || saving}
              >
                {deleting ? "Raderar…" : "Radera allt CV-innehåll"}
              </button>
            </div>
          )}

          <div className="form-footer">
            <button disabled={saving}>
              {saving ? "Sparar…" : "Spara CV"}
            </button>
            {!saving && saveState === "dirty" && (
              <span className="save-indicator save-indicator-dirty" role="status">
                Osparade ändringar
              </span>
            )}
          </div>
        </form>
      )}
      {unsavedPrompt && (
        <UnsavedChangesDialog
          message={unsavedPrompt.message}
          onCancel={() => setUnsavedPrompt(null)}
          onDiscard={unsavedPrompt.onDiscard}
        />
      )}
    </section>
  );
}
