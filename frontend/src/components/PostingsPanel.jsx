import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeAdUrl } from "../adUrl.js";
import { request } from "../api.js";
import MatchScore from "./MatchScore.jsx";
import ModalOverlay from "./ModalOverlay.jsx";

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
  const resultsAnchorRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tracked, setTracked] = useState(() => new Set());
  const [savedSearches, setSavedSearches] = useState([]);

  function buildSearchLabel(search) {
    if (search.label?.trim()) return search.label.trim();
    if (search.q?.trim()) return search.q.trim();
    return "Sparad sökning";
  }

  const loadSavedSearches = useCallback(async () => {
    try {
      const rows = await request("/api/v1/me/saved-searches/");
      setSavedSearches(rows);
    } catch {
      /* non-fatal when logged out */
    }
  }, []);

  // Load filter options + which ads are already on the board (by URL).
  useEffect(() => {
    loadSavedSearches();
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
        const data = await request("/api/v1/applications/tracked-urls/");
        const urls = new Set();
        for (const adUrl of data.urls) {
          const key = normalizeAdUrl(adUrl);
          if (key) urls.add(key);
        }
        setTracked(urls);
      } catch {
        /* non-fatal */
      }
    })();
  }, [loadSavedSearches]);

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

  useEffect(() => {
    resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [offset, query]);

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
        setTracked((prev) => new Set(prev).add(normalizeAdUrl(job.webpage_url)));
      }
      setMessage(`"${job.title}" sparades på tavlan (Sparad).`);
      window.dispatchEvent(new Event("application-created"));
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function saveCurrentSearch() {
    setMessage(null);
    const label = q.trim() || "Sparad sökning";
    try {
      await request("/api/v1/me/saved-searches/", {
        method: "POST",
        body: {
          label,
          q,
          region,
          municipality,
          field,
          group,
          remote,
        },
      });
      setMessage(`Sökningen "${label}" sparades.`);
      loadSavedSearches();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function applySavedSearch(saved) {
    setQ(saved.q || "");
    setRegion(saved.region || "");
    setMunicipality(saved.municipality || "");
    setField(saved.field || "");
    setGroup(saved.group || "");
    setRemote(!!saved.remote);
    setOffset(0);
    setQuery({
      q: saved.q || "",
      region: saved.region || "",
      municipality: saved.municipality || "",
      field: saved.field || "",
      group: saved.group || "",
      remote: !!saved.remote,
    });
  }

  async function removeSavedSearch(id) {
    try {
      await request(`/api/v1/me/saved-searches/${id}/`, { method: "DELETE" });
      setSavedSearches((rows) => rows.filter((row) => row.id !== id));
    } catch (err) {
      setMessage(err.message);
    }
  }

  const total = data?.total ?? 0;
  const results = (data?.results ?? []).slice().sort((a, b) => {
    const aTracked = a.webpage_url && tracked.has(normalizeAdUrl(a.webpage_url));
    const bTracked = b.webpage_url && tracked.has(normalizeAdUrl(b.webpage_url));
    if (aTracked !== bTracked) return aTracked ? 1 : -1;
    const aMatch = a.match?.count ?? -1;
    const bMatch = b.match?.count ?? -1;
    if (bMatch !== aMatch) return bMatch - aMatch;
    return 0;
  });
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
    <div className="stack">
      <section className="command-hero command-hero--compact">
        <div className="command-hero-copy">
          <span className="section-kicker">Platsbanken live</span>
          <h2>Hitta nästa jobb</h2>
          <p className="muted">
            Sök i hela Platsbanken, filtrera på län, ort och yrke — och spara
            intressanta annonser direkt på din tavla.
          </p>
        </div>
        <div className="metric-inline" aria-label="Söksammanfattning">
          <div className="metric-tile metric-tile--cyan">
            <span className="metric-label">Träffar</span>
            <strong>{total.toLocaleString("sv-SE")}</strong>
            <span className="metric-detail">i sökningen</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Sparade</span>
            <strong>{tracked.size}</strong>
            <span className="metric-detail">på tavlan</span>
          </div>
        </div>
      </section>

      <section className="card">
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

      <div className="saved-search-tools">
        <button
          type="button"
          className="secondary small"
          onClick={saveCurrentSearch}
          disabled={!(q || region || municipality || field || group || remote)}
        >
          Spara sökning
        </button>
        {savedSearches.length > 0 && (
          <div className="saved-search-list" aria-label="Sparade sökningar">
            {savedSearches.map((saved) => (
              <span className="saved-search-chip" key={saved.id}>
                <button type="button" onClick={() => applySavedSearch(saved)}>
                  {buildSearchLabel(saved)}
                </button>
                <button
                  type="button"
                  className="saved-search-remove"
                  onClick={() => removeSavedSearch(saved.id)}
                  aria-label={`Ta bort ${buildSearchLabel(saved)}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

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
        <p className="muted job-count" ref={resultsAnchorRef}>
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
            tracked={
              !!job.webpage_url && tracked.has(normalizeAdUrl(job.webpage_url))
            }
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
          tracked={
            !!selected.webpage_url &&
            tracked.has(normalizeAdUrl(selected.webpage_url))
          }
          onTrack={() => {
            track(selected);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
    </div>
  );
}

function JobCard({ job, tracked, onOpen, onTrack }) {
  return (
    <div className={tracked ? "job-card job-card--tracked" : "job-card"}>
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
          {job.match && <MatchScore match={job.match} variant="compact" />}
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
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector("button, a")?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <ModalOverlay
      onClose={onClose}
      className="modal job-modal"
      dialogRef={dialogRef}
      labelledBy="job-modal-title"
    >
      <div className="modal-head">
          <div className="modal-head-text">
            <h2 id="job-modal-title">{job.title}</h2>
            <p className="muted">
              {job.company_name}
              {job.location && ` — ${job.location}`}
              {job.application_deadline &&
                ` · sista ansökningsdag ${job.application_deadline}`}
            </p>
          </div>
          <button
            type="button"
            className="secondary small modal-close"
            onClick={onClose}
            aria-label="Stäng"
          >
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

        {job.match && <MatchScore match={job.match} variant="detail" />}

        <div className="description">
          {job.description || "Ingen beskrivning tillgänglig för den här annonsen."}
        </div>
    </ModalOverlay>
  );
}
