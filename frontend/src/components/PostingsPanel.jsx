import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";

const PAGE_SIZE = 25;

export default function PostingsPanel() {
  const [filters, setFilters] = useState({ regions: [], fields: [] });
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [field, setField] = useState("");
  const [remote, setRemote] = useState(false);
  // The query that results actually reflect (only changes on submit).
  const [query, setQuery] = useState({ q: "", region: "", field: "", remote: false });
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tracked, setTracked] = useState(() => new Set());

  // Load filter options + which ads are already on the board (by URL).
  useEffect(() => {
    request("/api/v1/jobs/filters/").then(setFilters).catch(() => {});
    (async () => {
      try {
        let url = "/api/v1/applications/";
        const urls = new Set();
        while (url) {
          const page = await request(url);
          for (const a of page.results) if (a.ad_url) urls.add(a.ad_url);
          url = page.next;
        }
        setTracked(urls);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (query.q.trim()) params.set("q", query.q.trim());
      if (query.region) params.set("region", query.region);
      if (query.field) params.set("field", query.field);
      if (query.remote) params.set("remote", "true");
      const result = await request(`/api/v1/jobs/?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(
        err.status === 502
          ? "Kunde inte nå Platsbanken just nu. Försök igen om en stund."
          : err.message
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query, offset]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  function submit(event) {
    event.preventDefault();
    setOffset(0);
    setQuery({ q, region, field, remote });
  }

  function clearFilters() {
    setQ("");
    setRegion("");
    setField("");
    setRemote(false);
    setOffset(0);
    setQuery({ q: "", region: "", field: "", remote: false });
  }

  async function track(job) {
    setMessage(null);
    try {
      await request("/api/v1/applications/", {
        method: "POST",
        body: {
          company: job.company_name || "Okänt företag",
          title: job.title,
          location: job.location,
          ad_url: job.webpage_url,
          deadline: job.application_deadline,
          status: "wishlist",
        },
      });
      if (job.webpage_url) {
        setTracked((prev) => new Set(prev).add(job.webpage_url));
      }
      setMessage(`"${job.title}" sparades på tavlan (Sparad).`);
      window.dispatchEvent(new Event("application-created"));
    } catch (err) {
      setMessage(err.message);
    }
  }

  const total = data?.total ?? 0;
  const results = data?.results ?? [];
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);
  const activeFilters = query.q || query.region || query.field || query.remote;

  return (
    <section className="card">
      <h2>Sök jobb i hela Platsbanken</h2>
      <p className="muted">
        Live från Arbetsförmedlingen. Filtrera på ort (region), yrkesområde
        och distans — spara intressanta annonser direkt på din tavla.
      </p>

      <form className="job-search" onSubmit={submit}>
        <input
          className="job-search-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök yrke, företag, kompetens…"
        />
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Hela Sverige</option>
          {filters.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">Alla yrkesområden</option>
          {filters.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="job-remote" title="Visa bara jobb som kan utföras på distans">
          <input
            type="checkbox"
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
          />
          Endast distans
        </label>
        <button className="small">Sök</button>
      </form>

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="loading-row">
          <span className="spinner" /> Söker i Platsbanken…
        </div>
      )}

      {!error && !loading && (
        <p className="muted job-count">
          {total === 0
            ? "Inga annonser matchade din sökning."
            : `Visar ${showingFrom}–${showingTo} av ${total.toLocaleString(
                "sv-SE"
              )} annonser`}
          {activeFilters && (
            <button className="linklike job-clear" onClick={clearFilters}>
              Rensa filter
            </button>
          )}
        </p>
      )}

      <div className="job-list">
        {results.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            tracked={!!job.webpage_url && tracked.has(job.webpage_url)}
            onOpen={() => setSelected(job)}
            onTrack={() => track(job)}
          />
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="pager">
          <button
            className="secondary small"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Föregående
          </button>
          <button
            className="secondary small"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Nästa →
          </button>
        </div>
      )}

      {selected && (
        <JobDetail
          job={selected}
          tracked={!!selected.webpage_url && tracked.has(selected.webpage_url)}
          onTrack={() => {
            track(selected);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function JobCard({ job, tracked, onOpen, onTrack }) {
  return (
    <div className="job-card">
      <div className="job-card-main">
        <button className="linklike job-title" onClick={onOpen}>
          {job.title}
        </button>
        <p className="muted">
          {job.company_name}
          {job.location && ` · ${job.location}`}
        </p>
        <div className="job-tags">
          {job.remote && <span className="badge neutral">Distans</span>}
          {job.application_deadline && (
            <span className="badge neutral">
              Sista ansökningsdag {job.application_deadline}
            </span>
          )}
          {job.match && (
            <span
              className={`badge ${job.match.count > 0 ? "applied" : "neutral"}`}
              title={job.match.matched.join(", ")}
            >
              {job.match.count}/{job.match.total} kompetenser
            </span>
          )}
        </div>
      </div>
      <button
        className="secondary small job-track"
        onClick={onTrack}
        disabled={tracked}
      >
        {tracked ? "På tavlan ✓" : "+ Spara"}
      </button>
    </div>
  );
}

function JobDetail({ job, tracked, onTrack, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal job-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-head-text">
            <h2>{job.title}</h2>
            <p className="muted">
              {job.company_name}
              {job.location && ` — ${job.location}`}
              {job.application_deadline &&
                ` · sista ansökningsdag ${job.application_deadline}`}
            </p>
          </div>
          <button className="secondary small modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-actions">
          {job.webpage_url && (
            <a
              className="btn-primary"
              href={job.webpage_url}
              target="_blank"
              rel="noreferrer"
            >
              Ansök på platsannonsen ↗
            </a>
          )}
          <button className="secondary" onClick={onTrack} disabled={tracked}>
            {tracked ? "På tavlan ✓" : "+ Spara på tavlan"}
          </button>
        </div>
        <p className="muted modal-hint">
          Ansökan görs hos arbetsgivaren — spara den här så följer du den på din
          tavla.
        </p>

        {job.match && (
          <p className="modal-match">
            <span
              className={`badge ${job.match.count > 0 ? "applied" : "neutral"}`}
            >
              Matchar {job.match.count}/{job.match.total} av dina kompetenser
            </span>{" "}
            {job.match.matched.map((skill) => (
              <span className="badge neutral" key={skill}>
                {skill}
              </span>
            ))}
          </p>
        )}

        <div className="description">
          {job.description || "Ingen beskrivning tillgänglig för den här annonsen."}
        </div>
      </div>
    </div>
  );
}
