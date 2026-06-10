import { useState } from "react";

import { request } from "../api.js";

export default function PartnerPanel() {
  const [apiKey, setApiKey] = useState("");
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  async function lookup(event) {
    event.preventDefault();
    setError(null);
    setEvents(null);
    const params = new URLSearchParams({ person });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      setEvents(
        await request(`/api/v1/partner/application-events/?${params}`, { apiKey })
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={lookup}>
        <h2>Hämta händelser för en person</h2>
        <p className="muted">
          A-kassans vy: fråga på personnummer för en tidsperiod. Uppslaget
          sker via nycklad hash — numret lagras aldrig. Okänd person ger
          tom lista. Varje anrop auditloggas.
        </p>
        <label>
          API-nyckel
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="utfärdas med manage.py create_partner"
            required
          />
        </label>
        <div className="grid3">
          <label>
            Personnummer
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="ÅÅÅÅMMDD-NNNN"
              required
            />
          </label>
          <label>
            Från
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Till
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button>Hämta händelser</button>
      </form>

      {events && (
        <section className="card">
          <h2>Resultat ({events.length})</h2>
          {events.length === 0 ? (
            <p className="muted">
              Inga händelser — antingen finns inga ansökningar i perioden,
              eller så är personen okänd (avslöjas inte).
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Sökt datum</th>
                  <th>Tjänst</th>
                  <th>Företag</th>
                  <th>Registrerad</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.applied_at}</td>
                    <td>{e.posting_title}</td>
                    <td>{e.company_name}</td>
                    <td>{new Date(e.created_at).toLocaleString("sv-SE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted">
            Notera vad som <em>inte</em> lämnas ut: status, identiteter,
            andra personers data.
          </p>
        </section>
      )}
    </div>
  );
}
