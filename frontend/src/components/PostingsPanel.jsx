import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";

export default function PostingsPanel({ token }) {
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

  async function track(posting) {
    setMessage(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await request("/api/v1/applications/", {
        method: "POST",
        token,
        body: { posting: posting.id, applied_at: today },
      });
      setMessage(`"${posting.title}" ligger nu på din tavla.`);
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
        Importerade från Arbetsförmedlingens öppna JobTech-API (Platsbanken).
        Hittade du jobbet någon annanstans? Lägg till det manuellt på tavlan.
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
                <button className="small" onClick={() => track(p)}>
                  Lägg på tavlan
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
          onTrack={track}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function PostingDetail({ id, token, onTrack, onClose }) {
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
              {posting.application_deadline &&
                ` · sista ansökningsdag ${posting.application_deadline}`}
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
              {posting.description ||
                "Ingen beskrivning tillgänglig för den här annonsen."}
            </div>
            <div className="row-between">
              <button
                onClick={() => {
                  onTrack(posting);
                  onClose();
                }}
              >
                Lägg på tavlan
              </button>
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
