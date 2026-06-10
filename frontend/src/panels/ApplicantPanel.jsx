import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";

export default function ApplicantPanel() {
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);

  if (!token) {
    return (
      <BankIDLogin
        onLogin={async (access) => {
          setToken(access);
          setMe(await request("/api/v1/me/", { token: access }));
        }}
      />
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
      <MyApplications token={token} />
      <Postings token={token} />
    </div>
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
      )}
    </section>
  );
}

function Postings({ token }) {
  const [page, setPage] = useState(null);
  const [url, setUrl] = useState("/api/v1/postings/");
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    request(url).then(setPage).catch((err) => setMessage(err.message));
  }, [url]);

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
      {message && <p className="notice">{message}</p>}
      <table>
        <thead>
          <tr>
            <th>Titel</th>
            <th>Företag</th>
            <th>Ort</th>
            <th>Källa</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {page.results.map((p) => (
            <tr key={p.id}>
              <td>
                <button className="linklike" onClick={() => setSelectedId(p.id)}>
                  {p.title}
                </button>
              </td>
              <td>{p.company_name}</td>
              <td>{p.location || "—"}</td>
              <td><span className="badge neutral">{p.source}</span></td>
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
          onApply={() => apply(selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function PostingDetail({ id, onApply, onClose }) {
  const [posting, setPosting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    request(`/api/v1/postings/${id}/`)
      .then(setPosting)
      .catch((err) => setError(err.message));
  }, [id]);

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
