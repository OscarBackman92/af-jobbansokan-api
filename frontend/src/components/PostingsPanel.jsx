import { useCallback, useEffect, useState } from "react";

import { request } from "../api.js";

const PAGE_SIZE = 25;

export default function PostingsPanel() {
  const [filters, setFilters] = useState({ regions: [], fields: [] });
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [municipalities, setMunicipalities] = useState([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [municipalitiesError, setMunicipalitiesError] = useState(null);
  const [field, setField] = useState("");
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [filtersError, setFiltersError] = useState(null);
  const [groupsError, setGroupsError] = useState(null);
  const [remote, setRemote] = useState(false);
  // The query that results actually reflect (only changes on submit).
  const [query, setQuery] = useState({
    q: "",
    region: "",
    municipality: "",
    field: "",
    group: "",
    remote: false,
  });
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tracked, setTracked] = useState(() => new Set());

  // Load filter options + which ads are already on the board (by URL).
  useEffect(() => {
    request("/api/v1/jobs/filters/")
      .then((result) => {
        setFilters(result);
        setFiltersError(null);
      })
      .catch(() => {
        setFiltersError("Kunde inte hämta filter från Platsbanken.");
      });
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

  useEffect(() => {
    setMunicipalities([]);
    setMunicipalitiesError(null);
    if (!region) {
      setMunicipalitiesLoading(false);
      return undefined;
    }

    let cancelled = false;
    setMunicipalitiesLoading(true);
    request(`/api/v1/jobs/municipalities/?region=${encodeURIComponent(region)}`)
      .then((result) => {
        if (!cancelled) setMunicipalities(result.municipalities ?? []);
      })
      .catch(() => {
        if (!cancelled) setMunicipalitiesError("Kunde inte hämta orter just nu.");
      })
      .finally(() => {
        if (!cancelled) setMunicipalitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [region]);

  useEffect(() => {
    setGroups([]);
    setGroupsError(null);
    if (!field) {
      setGroupsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setGroupsLoading(true);
    request(`/api/v1/jobs/groups/?field=${encodeURIComponent(field)}`)
      .then((result) => {
        if (!cancelled) setGroups(result.groups ?? []);
      })
      .catch(() => {
        if (!cancelled) setGroupsError("Kunde inte hämta yrken just nu.");
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [field]);

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
      if (query.municipality) params.set("municipality", query.municipality);
      if (query.field) params.set("field", query.field);
      if (query.group) params.set("group", query.group);
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
    setQuery({ q, region, municipality, field, group, remote });
  }

  function clearFilters() {
    setQ("");
    setRegion("");
    setMunicipality("");
    setField("");
    setGroup("");
    setRemote(false);
    setOffset(0);
    setQuery({
      q: "",
      region: "",
      municipality: "",
      field: "",
      group: "",
      remote: false,
    });
  }

  function changeRegion(nextRegion) {
    setRegion(nextRegion);
    setMunicipality("");
  }

  function changeField(nextField) {
    setField(nextField);
    setGroup("");
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
  const locationOptions = municipalities;
  const municipalityDisabled =
    !region ||
    municipalitiesLoading ||
    !!municipalitiesError ||
    locationOptions.length === 0;
  const municipalityPlaceholder = !region
    ? "Välj län först"
    : municipalitiesLoading
      ? "Laddar orter..."
      : municipalitiesError
        ? "Kunde inte hämta orter"
        : "Alla orter";
  const fieldGroups = groups;
  const groupDisabled =
    !field || groupsLoading || !!groupsError || fieldGroups.length === 0;
  const groupPlaceholder = !field
    ? "Välj yrkesområde först"
    : groupsLoading
      ? "Laddar yrken..."
      : groupsError
        ? "Kunde inte hämta yrken"
        : "Alla yrken";
  const activeFilters =
    query.q ||
    query.region ||
    query.municipality ||
    query.field ||
    query.group ||
    query.remote;

  return (
    <section className="card">
      <h2>Sök jobb i hela Platsbanken</h2>
      <p className="muted">
        Live från Arbetsförmedlingen. Filtrera på län, ort, yrkesområde, yrke
        och distans — spara intressanta annonser direkt på din tavla.
      </p>

      <form className="job-search" onSubmit={submit}>
        <input
          className="job-search-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök yrke, företag, kompetens…"
        />
        <select value={region} onChange={(e) => changeRegion(e.target.value)}>
          <option value="">Hela Sverige</option>
          {filters.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={municipality}
          onChange={(e) => setMunicipality(e.target.value)}
          disabled={municipalityDisabled}
          title={region ? "Välj ort inom länet" : "Välj län först"}
        >
          <option value="">{municipalityPlaceholder}</option>
          {locationOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select value={field} onChange={(e) => changeField(e.target.value)}>
          <option value="">Alla yrkesområden</option>
          {filters.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          disabled={groupDisabled}
          title={
            field
              ? "Välj yrke inom yrkesområdet"
              : "Välj yrkesområde först"
          }
        >
          <option value="">{groupPlaceholder}</option>
          {fieldGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
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

      {filtersError && <p className="error">{filtersError}</p>}
      {municipalitiesError && <p className="error">{municipalitiesError}</p>}
      {groupsError && <p className="error">{groupsError}</p>}
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
