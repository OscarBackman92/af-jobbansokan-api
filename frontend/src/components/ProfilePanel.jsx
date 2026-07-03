import { useEffect, useState } from "react";

import { request } from "../api.js";
import {
  EMPTY_SKILL_GROUPS,
  SKILL_GROUP_HINTS,
  SKILL_GROUP_LABELS,
  groupsToText,
  hasSkillContent,
  normalizeSkillGroups,
  textToGroups,
} from "../skills.js";

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
};

function hasCvContent(resume, skillGroups) {
  return (
    resume.headline ||
    resume.summary ||
    hasSkillContent(skillGroups) ||
    resume.experience.length ||
    resume.education.length
  );
}

function CvReadView({ resume, skillGroups }) {
  const groups = normalizeSkillGroups(skillGroups);
  const hasContent = hasCvContent(resume, groups);

  if (!hasContent) {
    return (
      <p className="muted">
        Inget CV ännu — ladda upp en fil eller klicka på Redigera för att
        fylla i.
      </p>
    );
  }

  return (
    <div className="cv-read">
      {resume.headline && <p className="cv-headline">{resume.headline}</p>}
      {resume.summary && <p className="muted">{resume.summary}</p>}

      {Object.entries(SKILL_GROUP_LABELS).map(([key, label]) =>
        groups[key]?.length ? (
          <div className="cv-skill-group" key={key}>
            <h3 className="cv-skill-group-label">{label}</h3>
            <div className="cv-skills">
              {groups[key].map((skill) => (
                <span className={`badge badge--skill-${key}`} key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ) : null
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
  const [skillGroupsText, setSkillGroupsText] = useState(() => groupsToText(EMPTY_SKILL_GROUPS));
  const [savedResume, setSavedResume] = useState(EMPTY_RESUME);
  const [savedSkillGroupsText, setSavedSkillGroupsText] = useState(() =>
    groupsToText(EMPTY_SKILL_GROUPS)
  );
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // "clean" = matches the server, "dirty" = unsaved edits.
  const [saveState, setSaveState] = useState("clean");

  useEffect(() => {
    setLoading(true);
    request("/api/v1/me/resume/", { token })
      .then((data) => {
        setResume(data);
        const text = groupsToText(data.skill_groups);
        setSkillGroupsText(text);
        setSavedResume(data);
        setSavedSkillGroupsText(text);
        setSaveState("clean");
      })
      .catch((err) => setMessage({ tone: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [token]);

  function revertEdits() {
    setResume(savedResume);
    setSkillGroupsText(savedSkillGroupsText);
    setSaveState("clean");
  }

  useEffect(() => {
    if (!profileLeaveGuardRef) return undefined;
    profileLeaveGuardRef.current = () => {
      if (!open || saveState !== "dirty") return true;
      const discard = window.confirm(
        "Du har osparade ändringar i CV:t. Lämna sidan utan att spara?"
      );
      if (discard) {
        setResume(savedResume);
        setSkillGroupsText(savedSkillGroupsText);
        setSaveState("clean");
      }
      return discard;
    };
    return () => {
      profileLeaveGuardRef.current = null;
    };
  }, [open, saveState, profileLeaveGuardRef, savedResume, savedSkillGroupsText]);

  function toggleEditor() {
    setMessage(null);
    if (open) {
      if (saveState === "dirty") {
        const discard = window.confirm(
          "Du har osparade ändringar i CV:t. Stäng utan att spara?"
        );
        if (!discard) return;
        revertEdits();
      }
      setOpen(false);
      return;
    }
    setOpen(true);
  }

  function setField(name, value) {
    setSaveState("dirty");
    setResume((current) => ({ ...current, [name]: value }));
  }

  function changeSkillGroup(key, value) {
    setSaveState("dirty");
    setSkillGroupsText((current) => ({ ...current, [key]: value }));
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
      if (draft.skill_groups) {
        setSkillGroupsText(groupsToText(draft.skill_groups));
      } else if (draft.skills?.length) {
        setSkillGroupsText(groupsToText({ ...EMPTY_SKILL_GROUPS, technical: draft.skills }));
      }
      setOpen(true);
      setSaveState("dirty");
      setMessage({
        tone: "info",
        text:
          "CV:t är tolkat och formuläret förifyllt — granska och spara. " +
          "Filen sparas aldrig.",
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
          skill_groups: textToGroups(skillGroupsText),
        },
      });
      const text = groupsToText(saved.skill_groups);
      setResume(saved);
      setSkillGroupsText(text);
      setSavedResume(saved);
      setSavedSkillGroupsText(text);
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
      setSkillGroupsText(groupsToText(EMPTY_SKILL_GROUPS));
      setSavedResume(EMPTY_RESUME);
      setSavedSkillGroupsText(groupsToText(EMPTY_SKILL_GROUPS));
      setSaveState("clean");
      setOpen(false);
      setMessage({ tone: "success", text: "CV:t är raderat." });
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setDeleting(false);
    }
  }

  const cvHasContent = hasCvContent(resume, textToGroups(skillGroupsText));

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Mitt CV</h2>
          <p className="muted">
            Kompetenserna jämförs mot annonstexten — dela upp dem så matchningen
            blir tydligare.
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
        <CvReadView resume={resume} skillGroups={textToGroups(skillGroupsText)} />
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
          <div className="skill-fields">
            <p className="muted cv-edit-hint">
              Kommaseparerade listor. Verktyg och metoder matchas mot annonsens
              text när du söker jobb.
            </p>
            {Object.entries(SKILL_GROUP_LABELS).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={skillGroupsText[key]}
                  onChange={(e) => changeSkillGroup(key, e.target.value)}
                  placeholder={SKILL_GROUP_HINTS[key]}
                />
              </label>
            ))}
          </div>

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
    </section>
  );
}
