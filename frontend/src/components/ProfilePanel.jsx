import { useEffect, useState } from "react";

import { request } from "../api.js";

export default function ProfilePanel({ token, me, onMeChange, onLogout }) {
  return (
    <div className="stack">
      <ProfileCard
        token={token}
        me={me}
        onMeChange={onMeChange}
        onLogout={onLogout}
      />
      <ResumeCard token={token} />
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
      setMessage("Profilen är uppdaterad.");
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

function CvReadView({ resume, skillsText }) {
  const skills = skillsText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hasContent =
    resume.headline ||
    resume.summary ||
    skills.length ||
    resume.experience.length ||
    resume.education.length;

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

      {skills.length > 0 && (
        <div className="cv-skills">
          {skills.map((skill) => (
            <span className="badge" key={skill}>
              {skill}
            </span>
          ))}
        </div>
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

function ResumeCard({ token }) {
  const [resume, setResume] = useState(EMPTY_RESUME);
  const [skillsText, setSkillsText] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    request("/api/v1/me/resume/", { token })
      .then((data) => {
        setResume(data);
        setSkillsText(data.skills.join(", "));
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  function setField(name, value) {
    setResume((current) => ({ ...current, [name]: value }));
  }

  function setRow(listName, index, key, value) {
    setResume((current) => {
      const rows = current[listName].map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      );
      return { ...current, [listName]: rows };
    });
  }

  function addRow(listName, emptyRow) {
    setResume((current) => ({
      ...current,
      [listName]: [...current[listName], emptyRow],
    }));
  }

  function removeRow(listName, index) {
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
      if (draft.skills.length) setSkillsText(draft.skills.join(", "));
      setOpen(true);
      setMessage(
        "CV:t är tolkat och formuläret förifyllt — granska och spara. " +
          "Filen sparas aldrig."
      );
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    setMessage(null);
    try {
      const saved = await request("/api/v1/me/resume/", {
        method: "PUT",
        token,
        body: {
          ...resume,
          skills: skillsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setResume(saved);
      setSkillsText(saved.skills.join(", "));
      setMessage("CV:t är sparat.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Mitt CV</h2>
          <p className="muted">
            Används för att matcha dina kompetenser mot annonserna.
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
          <button className="secondary small" onClick={() => setOpen(!open)}>
            {open ? "Stäng" : "Redigera"}
          </button>
        </div>
      </div>
      {message && <p className="notice">{message}</p>}
      {loading && (
        <div className="loading-row">
          <span className="spinner" /> Laddar CV…
        </div>
      )}
      {!loading && !open && <CvReadView resume={resume} skillsText={skillsText} />}
      {!loading && open && (
        <form onSubmit={save}>
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
          <label>
            Kompetenser (kommaseparerade)
            <input
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="Python, Django, PostgreSQL"
            />
          </label>

          <h3>Erfarenhet</h3>
          {resume.experience.map((row, i) => (
            <div className="resume-row" key={i}>
              <div className="rowline">
                <input
                  value={row.title}
                  onChange={(e) => setRow("experience", i, "title", e.target.value)}
                  placeholder="Titel"
                />
                <input
                  value={row.company}
                  onChange={(e) =>
                    setRow("experience", i, "company", e.target.value)
                  }
                  placeholder="Företag"
                />
                <input
                  value={row.years}
                  onChange={(e) => setRow("experience", i, "years", e.target.value)}
                  placeholder="År"
                />
                <button
                  type="button"
                  className="danger small"
                  onClick={() => removeRow("experience", i)}
                >
                  ✕
                </button>
              </div>
              <textarea
                className="resume-description"
                value={row.description || ""}
                onChange={(e) =>
                  setRow("experience", i, "description", e.target.value)
                }
                placeholder="Kort beskrivning, ansvar eller resultat"
              />
            </div>
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
            <div className="rowline" key={i}>
              <input
                value={row.school}
                onChange={(e) => setRow("education", i, "school", e.target.value)}
                placeholder="Lärosäte"
              />
              <input
                value={row.degree}
                onChange={(e) => setRow("education", i, "degree", e.target.value)}
                placeholder="Examen/inriktning"
              />
              <input
                value={row.years}
                onChange={(e) => setRow("education", i, "years", e.target.value)}
                placeholder="År"
              />
              <button
                type="button"
                className="danger small"
                onClick={() => removeRow("education", i)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary small"
            onClick={() => addRow("education", { school: "", degree: "", years: "" })}
          >
            + Lägg till utbildning
          </button>

          <div style={{ marginTop: "1rem" }}>
            <button>Spara CV</button>
          </div>
        </form>
      )}
    </section>
  );
}
