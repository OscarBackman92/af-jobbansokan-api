import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";

export default function EmployerPanel() {
  const [token, setToken] = useState(null);

  if (!token) return <EmployerLogin onLogin={setToken} />;
  return (
    <div className="stack">
      <div className="card row-between">
        <div>Inloggad som arbetsgivare</div>
        <button className="secondary" onClick={() => setToken(null)}>
          Logga ut
        </button>
      </div>
      <CreatePosting token={token} />
      <OrgApplications token={token} />
    </div>
  );
}

function EmployerLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function login(event) {
    event.preventDefault();
    setError(null);
    try {
      const data = await request("/dj-rest-auth/login/", {
        method: "POST",
        body: { username, password },
      });
      onLogin(data.access);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card narrow" onSubmit={login}>
      <h2>Logga in som arbetsgivare</h2>
      <p className="muted">
        Demo: <code>acme_admin</code> / <code>Testpass123!</code>
      </p>
      <label>
        Användarnamn
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Lösenord
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button>Logga in</button>
    </form>
  );
}

function CreatePosting({ token }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState(null);

  async function create(event) {
    event.preventDefault();
    setMessage(null);
    try {
      const posting = await request("/api/v1/postings/", {
        method: "POST",
        token,
        body: { title, company_name: company, location },
      });
      setMessage(`Annons #${posting.id} skapad under ${posting.organization.name}.`);
      setTitle("");
      setCompany("");
      setLocation("");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <form className="card" onSubmit={create}>
      <h2>Skapa annons</h2>
      <p className="muted">
        Kräver admin-roll — annonsen hamnar alltid under din egen
        organisation.
      </p>
      <div className="grid3">
        <label>
          Titel
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Företag
          <input value={company} onChange={(e) => setCompany(e.target.value)} required />
        </label>
        <label>
          Ort
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      {message && <p className="notice">{message}</p>}
      <button>Publicera</button>
    </form>
  );
}

function OrgApplications({ token }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    request("/api/v1/employer/applications/", { token })
      .then(setPage)
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="card">
      <h2>Ansökningar till min organisation</h2>
      <p className="muted">
        Varje hämtning loggas i auditloggen som en utlämning.
      </p>
      {error && <p className="error">{error}</p>}
      {page && page.results.length === 0 && (
        <p className="muted">Inga ansökningar ännu.</p>
      )}
      {page && page.results.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Sökande</th>
              <th>Annons</th>
              <th>Sökt datum</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {page.results.map((a) => (
              <tr key={a.id}>
                <td>{a.owner.username}</td>
                <td>{a.posting.title}</td>
                <td>{a.applied_at}</td>
                <td><span className={`badge ${a.status}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="secondary small" onClick={reload}>
        Uppdatera (loggas som utlämning)
      </button>
    </section>
  );
}
