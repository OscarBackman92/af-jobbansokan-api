import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";

export default function ApplicantPanel() {
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);

  if (!token) {
    return (
      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Förtroende som grundfunktion</span>
          <h2>
            Sök jobb. Bevisa det.
            <br />
            <span className="grad">Äg din egen data.</span>
          </h2>
          <p className="lede">
            Hela svenska annonsmarknaden, en BankID-verifierad profil och en
            ansökningshistorik som ingen kan manipulera — inte ens vi.
          </p>
          <ul className="checklist">
            <li>BankID-verifierad identitet, pseudonymiserad lagring</li>
            <li>Oföränderliga ansökningshändelser med full auditlogg</li>
            <li>Se exakt vem som tagit del av dina uppgifter, och när</li>
            <li>CV som matchas mot varje annons — helt förklarbart</li>
          </ul>
        </div>
        <BankIDLogin
          onLogin={async (access) => {
            setToken(access);
            setMe(await request("/api/v1/me/", { token: access }));
          }}
        />
      </div>
    );
  }
  return (
    <div className="stack">
      <ProfileCard
        token={token}
        me={me}
        onMeChange={setMe}
        onLogout={() => {
          setToken(null);
          setMe(null);
        }}
      />
      <ResumeCard token={token} />
      <MyApplications token={token} />
      <DisclosuresCard token={token} />
      <Postings token={token} />
    </div>
  );
}

const EMPTY_RESUME = {
  headline: "",
  summary: "",
  skills: [],
  experience: [],
  education: [],
};

function ResumeCard({ token }) {
  const [resume, setResume] = useState(EMPTY_RESUME);
  const [skillsText, setSkillsText] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    request("/api/v1/me/resume/", { token }).then((data) => {
      setResume(data);
      setSkillsText(data.skills.join(", "));
    });
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
            {resume.headline
              ? resume.headline
              : "Inget CV ännu — fyll i formuläret eller ladda upp en fil."}
            {resume.skills.length > 0 && ` · ${resume.skills.length} kompetenser`}
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
      {open && (
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
            <div className="rowline" key={i}>
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

function DisclosuresCard({ token }) {
  const [page, setPage] = useState(null);

  const reload = useCallback(() => {
    request("/api/v1/me/disclosures/", { token }).then(setPage).catch(() => {});
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="card">
      <h2>Utlämningar av mina uppgifter</h2>
      <p className="muted">
        Insyn: varje gång en A-kassa hämtar dina ansökningshändelser loggas
        det — här ser du av vem och för vilken period.
      </p>
      {page && page.count === 0 && (
        <p className="muted">Inga utlämningar har skett.</p>
      )}
      {page && page.count > 0 && (
        <table>
          <thead>
            <tr>
              <th>När</th>
              <th>Mottagare</th>
              <th>Period</th>
              <th>Antal händelser</th>
            </tr>
          </thead>
          <tbody>
            {page.results.map((d) => (
              <tr key={d.id}>
                <td>{new Date(d.created_at).toLocaleString("sv-SE")}</td>
                <td>{d.partner_name}</td>
                <td>
                  {d.date_from || "…"} – {d.date_to || "…"}
                </td>
                <td>{d.application_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="secondary small" onClick={reload}>
        Uppdatera
      </button>
    </section>
  );
}

function ProfileCard({ token, me, onMeChange, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "" });
  const [message, setMessage] = useState(null);

  if (!me) return <div className="card">Laddar profil…</div>;

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
      "Radera kontot permanent? Alla dina ansökningar tas bort. " +
        "Auditloggen behålls i anonymiserad form (GDPR)."
    );
    if (!sure) return;
    await request("/api/v1/me/", { method: "DELETE", token });
    onLogout();
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Min profil</h2>
          <p className="muted">
            <strong>{me.username}</strong>
            {(me.first_name || me.last_name) &&
              ` — ${me.first_name} ${me.last_name}`.trimEnd()}
            {me.email && ` · ${me.email}`}
          </p>
          {me.identity?.verified ? (
            <span className="badge applied">
              BankID-verifierad ({me.identity.method})
            </span>
          ) : (
            <span className="badge neutral">Ej identitetsverifierad</span>
          )}
        </div>
        <div className="row-gap">
          <button
            className="secondary small"
            onClick={editing ? () => setEditing(false) : startEdit}
          >
            {editing ? "Avbryt" : "Redigera"}
          </button>
          <button className="secondary small" onClick={onLogout}>
            Logga ut
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

function BankIDLogin({ onLogin }) {
  const [pnr, setPnr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const initiate = await request("/api/v1/auth/bankid/initiate/", {
        method: "POST",
        body: { personal_number: pnr },
      });
      const collect = await request("/api/v1/auth/bankid/collect/", {
        method: "POST",
        body: { order_ref: initiate.order_ref },
      });
      await onLogin(collect.access);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={login}>
      <h2>Logga in med BankID</h2>
      <p className="muted">
        Mockat flöde — ange ett 12-siffrigt personnummer så skapas och
        verifieras identiteten direkt. Numret lagras aldrig, bara en
        nycklad hash.
      </p>
      <label>
        Personnummer
        <input
          value={pnr}
          onChange={(e) => setPnr(e.target.value)}
          placeholder="ÅÅÅÅMMDD-NNNN"
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? "Verifierar…" : "Logga in (mock)"}</button>
    </form>
  );
}

function MyApplications({ token }) {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const data = await request("/api/v1/applications/", { token });
      setApplications(data.results);
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

  async function remove(id) {
    await request(`/api/v1/applications/${id}/`, { method: "DELETE", token });
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

  return (
    <section className="card">
      <h2>Mina ansökningshändelser</h2>
      <p className="muted">
        Oföränderliga när de skapats — de kan raderas (loggas) men aldrig
        redigeras.
      </p>
      {error && <p className="error">{error}</p>}
      {applications.length === 0 ? (
        <p className="muted">Inga ansökningar ännu.</p>
      ) : (
        <>
        <table>
          <thead>
            <tr>
              <th>Sökt datum</th>
              <th>Annons-id</th>
              <th>Status</th>
              <th>Registrerad</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id}>
                <td>{a.applied_at}</td>
                <td>#{a.posting}</td>
                <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                <td>{new Date(a.created_at).toLocaleString("sv-SE")}</td>
                <td>
                  <button className="danger small" onClick={() => remove(a.id)}>
                    Radera
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="secondary small" onClick={exportCsv}>
          Exportera CSV
        </button>
        </>
      )}
    </section>
  );
}

function Postings({ token }) {
  const [page, setPage] = useState(null);
  const [url, setUrl] = useState("/api/v1/postings/");
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [favorites, setFavorites] = useState({});

  useEffect(() => {
    request(url, { token }).then(setPage).catch((err) => setMessage(err.message));
  }, [url, token]);

  const loadFavorites = useCallback(() => {
    request("/api/v1/favorites/", { token }).then((data) => {
      const map = {};
      for (const f of data.results) map[f.posting] = f.id;
      setFavorites(map);
    });
  }, [token]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  async function toggleFavorite(postingId) {
    if (favorites[postingId]) {
      await request(`/api/v1/favorites/${favorites[postingId]}/`, {
        method: "DELETE",
        token,
      });
    } else {
      await request("/api/v1/favorites/", {
        method: "POST",
        token,
        body: { posting: postingId },
      });
    }
    loadFavorites();
  }

  function applyFilters(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (location.trim()) params.set("location", location.trim());
    const qs = params.toString();
    setUrl(`/api/v1/postings/${qs ? `?${qs}` : ""}`);
  }

  async function apply(postingId) {
    setMessage(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await request("/api/v1/applications/", {
        method: "POST",
        token,
        body: { posting: postingId, applied_at: today },
      });
      setMessage(`Ansökan registrerad på annons #${postingId}.`);
      window.dispatchEvent(new Event("application-created"));
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (!page) return <section className="card">Laddar annonser…</section>;
  return (
    <section className="card">
      <h2>Annonser ({page.count})</h2>
      <p className="muted">
        Importerade från Arbetsförmedlingens öppna JobTech-API plus
        plattformens egna annonser.
      </p>
      <form className="searchbar" onSubmit={applyFilters}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök titel, företag eller beskrivning…"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ort"
        />
        <button className="small">Sök</button>
      </form>
      {message && <p className="notice">{message}</p>}
      <table>
        <thead>
          <tr>
            <th />
            <th>Titel</th>
            <th>Företag</th>
            <th>Ort</th>
            <th>Matchning</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {page.results.map((p) => (
            <tr key={p.id}>
              <td>
                <button
                  className="star"
                  title={favorites[p.id] ? "Ta bort favorit" : "Spara som favorit"}
                  onClick={() => toggleFavorite(p.id)}
                >
                  {favorites[p.id] ? "★" : "☆"}
                </button>
              </td>
              <td>
                <button className="linklike" onClick={() => setSelectedId(p.id)}>
                  {p.title}
                </button>
              </td>
              <td>{p.company_name}</td>
              <td>{p.location || "—"}</td>
              <td>
                {p.match ? (
                  <span
                    className={`badge ${p.match.count > 0 ? "applied" : "neutral"}`}
                    title={p.match.matched.join(", ")}
                  >
                    {p.match.count}/{p.match.total} kompetenser
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <button className="small" onClick={() => apply(p.id)}>
                  Sök jobbet
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button
          className="secondary small"
          disabled={!page.previous}
          onClick={() => setUrl(page.previous)}
        >
          ← Föregående
        </button>
        <button
          className="secondary small"
          disabled={!page.next}
          onClick={() => setUrl(page.next)}
        >
          Nästa →
        </button>
      </div>
      {selectedId && (
        <PostingDetail
          id={selectedId}
          token={token}
          onApply={() => apply(selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function PostingDetail({ id, token, onApply, onClose }) {
  const [posting, setPosting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    request(`/api/v1/postings/${id}/`, { token })
      .then(setPosting)
      .catch((err) => setError(err.message));
  }, [id, token]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {error && <p className="error">{error}</p>}
        {!posting && !error && <p className="muted">Laddar annons…</p>}
        {posting && (
          <>
            <div className="row-between">
              <h2>{posting.title}</h2>
              <button className="secondary small" onClick={onClose}>
                Stäng ✕
              </button>
            </div>
            <p className="muted">
              {posting.company_name}
              {posting.location && ` — ${posting.location}`}
              {posting.published_at && ` · publicerad ${posting.published_at}`}
            </p>
            {posting.match && (
              <p>
                <span
                  className={`badge ${posting.match.count > 0 ? "applied" : "neutral"}`}
                >
                  Matchar {posting.match.count}/{posting.match.total} av dina
                  kompetenser
                </span>{" "}
                {posting.match.matched.map((skill) => (
                  <span className="badge neutral" key={skill}>
                    {skill}
                  </span>
                ))}
              </p>
            )}
            <div className="description">
              {posting.description || "Ingen beskrivning tillgänglig för den här annonsen."}
            </div>
            <div className="row-between">
              <button onClick={onApply}>Sök jobbet</button>
              {posting.webpage_url && (
                <a href={posting.webpage_url} target="_blank" rel="noreferrer">
                  Originalannons ↗
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
