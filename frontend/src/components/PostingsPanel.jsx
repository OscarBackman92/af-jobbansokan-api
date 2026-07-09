import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { normalizeAdUrl } from "../adUrl.js";
import { request } from "../api.js";
import { recordJobMatchGaps } from "../marketHints.js";
import MatchScore from "./MatchScore.jsx";
import ModalOverlay from "./ModalOverlay.jsx";
import MultiSelectFilter from "./MultiSelectFilter.jsx";

const PAGE_SIZE = 25;

const EMPTY_QUERY = {
  q: "",
  municipalities: [],
  groups: [],
  remote: false,
  matchCv: false,
};

function appendIdParams(params, key, items) {
  for (const item of items) {
    const id = typeof item === "string" ? item : item?.id;
    if (id) params.append(key, id);
  }
}

function countSummary(count, singular, plural) {
  if (!count) return null;
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export default function PostingsPanel() {
  const [filters, setFilters] = useState({ regions: [], fields: [] });
  const [q, setQ] = useState("");
  const [browseRegion, setBrowseRegion] = useState("");
  const [browseField, setBrowseField] = useState("");
  const [selectedMunicipalities, setSelectedMunicipalities] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [municipalityCache, setMunicipalityCache] = useState({});
  const [groupCache, setGroupCache] = useState({});
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [filtersError, setFiltersError] = useState(null);
  const [remote, setRemote] = useState(false);
  const [matchCvOnly, setMatchCvOnly] = useState(false);
  const [query, setQuery] = useState(EMPTY_QUERY);
  const [offset, setOffset] = useState(0);
  const resultsSectionRef = useRef(null);
  const pendingScrollRef = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tracked, setTracked] = useState(() => new Set());
  const [savedSearches, setSavedSearches] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameLabel, setRenameLabel] = useState("");

  function buildSearchLabel(search) {
    if (search.label?.trim()) return search.label.trim();
    if (search.q?.trim()) return search.q.trim();
    const municipalityCount = search.municipalities?.length ?? 0;
    const groupCount = search.groups?.length ?? 0;
    if (groupCount === 1 && search.group_labels?.[0]) return search.group_labels[0];
    if (municipalityCount === 1) return "1 ort";
    if (groupCount) return `${groupCount} yrken`;
    if (municipalityCount) return `${municipalityCount} orter`;
    if (search.match_cv) return "Passar mitt CV";
    if (search.remote) return "Distansjobb";
    return "Sparad sökning";
  }

  function buildSuggestedLabel() {
    if (q.trim()) return q.trim();
    if (selectedGroups.length === 1) return selectedGroups[0].label;
    if (selectedMunicipalities.length === 1) return selectedMunicipalities[0].label;
    if (selectedGroups.length) return `${selectedGroups.length} yrken`;
    if (selectedMunicipalities.length) return `${selectedMunicipalities.length} orter`;
    if (matchCvOnly) return "Passar mitt CV";
    if (remote) return "Distansjobb";
    return "Min sökning";
  }

  const loadSavedSearches = useCallback(async () => {
    try {
      const rows = await request("/api/v1/me/saved-searches/");
      setSavedSearches(Array.isArray(rows) ? rows : (rows?.results ?? []));
    } catch {
      /* non-fatal when logged out */
    }
  }, []);

  useEffect(() => {
    loadSavedSearches();
    request("/api/v1/jobs/filters/")
      .then((result) => {
        setFilters(result);
        setFiltersError(null);
        setBrowseRegion((prev) => prev || result.regions?.[0]?.id || "");
        setBrowseField((prev) => prev || result.fields?.[0]?.id || "");
      })
      .catch(() => {
        setFiltersError("Kunde inte hämta filter från Platsbanken.");
      });
    (async () => {
      try {
        const trackedData = await request("/api/v1/applications/tracked-urls/");
        const urls = new Set();
        for (const adUrl of trackedData.urls) {
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
    if (!browseRegion || municipalityCache[browseRegion]) return undefined;
    let cancelled = false;
    setMunicipalitiesLoading(true);
    request(`/api/v1/jobs/municipalities/?region=${encodeURIComponent(browseRegion)}`)
      .then((result) => {
        if (!cancelled) {
          setMunicipalityCache((prev) => ({
            ...prev,
            [browseRegion]: result.municipalities ?? [],
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMunicipalityCache((prev) => ({ ...prev, [browseRegion]: [] }));
        }
      })
      .finally(() => {
        if (!cancelled) setMunicipalitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [browseRegion, municipalityCache]);

  useEffect(() => {
    if (!browseField || groupCache[browseField]) return undefined;
    let cancelled = false;
    setGroupsLoading(true);
    request(`/api/v1/jobs/groups/?field=${encodeURIComponent(browseField)}`)
      .then((result) => {
        if (!cancelled) {
          setGroupCache((prev) => ({
            ...prev,
            [browseField]: result.groups ?? [],
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroupCache((prev) => ({ ...prev, [browseField]: [] }));
        }
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [browseField, groupCache]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (query.q.trim()) params.set("q", query.q.trim());
      appendIdParams(params, "municipality", query.municipalities);
      appendIdParams(params, "group", query.groups);
      if (query.remote) params.set("remote", "true");
      if (query.matchCv) params.set("match_cv", "true");
      const result = await request(`/api/v1/jobs/?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(
        err.status === 502
          ? "Kunde inte nå Platsbanken just nu. Försök igen om en stund."
          : err.status >= 500
            ? "Sökningen misslyckades på servern. Prova färre filter eller försök igen."
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

  function scrollToResults() {
    const section = resultsSectionRef.current;
    const scrollOpts = { left: 0, behavior: "instant" };
    if (!section) {
      window.scrollTo({ top: 0, ...scrollOpts });
      return;
    }
    const top = section.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: Math.max(0, top), ...scrollOpts });
  }

  function requestResultsScroll() {
    pendingScrollRef.current = true;
    scrollToResults();
  }

  useLayoutEffect(() => {
    if (!pendingScrollRef.current) return;
    if (loading) {
      scrollToResults();
      return;
    }
    pendingScrollRef.current = false;
    scrollToResults();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToResults);
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, data, offset, query]);

  function goToPage(nextOffset) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestResultsScroll();
    setOffset(nextOffset);
  }

  function submit(event) {
    event.preventDefault();
    requestResultsScroll();
    setOffset(0);
    setQuery({
      q,
      municipalities: selectedMunicipalities,
      groups: selectedGroups,
      remote,
      matchCv: matchCvOnly,
    });
  }

  function clearFilters() {
    setQ("");
    setSelectedMunicipalities([]);
    setSelectedGroups([]);
    setRemote(false);
    setMatchCvOnly(false);
    requestResultsScroll();
    setOffset(0);
    setQuery(EMPTY_QUERY);
  }

  function toggleMunicipality(option) {
    setSelectedMunicipalities((prev) => {
      if (prev.some((row) => row.id === option.id)) {
        return prev.filter((row) => row.id !== option.id);
      }
      return [...prev, { id: option.id, label: option.label }];
    });
  }

  function selectAllMunicipalities(checked, options) {
    if (!checked) {
      const remove = new Set(options.map((option) => option.id));
      setSelectedMunicipalities((prev) => prev.filter((row) => !remove.has(row.id)));
      return;
    }
    setSelectedMunicipalities((prev) => {
      const byId = new Map(prev.map((row) => [row.id, row]));
      for (const option of options) byId.set(option.id, option);
      return [...byId.values()];
    });
  }

  function clearVisibleMunicipalities(options) {
    const remove = new Set(options.map((option) => option.id));
    setSelectedMunicipalities((prev) => prev.filter((row) => !remove.has(row.id)));
  }

  function toggleGroup(option) {
    setSelectedGroups((prev) => {
      if (prev.some((row) => row.id === option.id)) {
        return prev.filter((row) => row.id !== option.id);
      }
      return [...prev, { id: option.id, label: option.label }];
    });
  }

  function selectAllGroups(checked, options) {
    if (!checked) {
      const remove = new Set(options.map((option) => option.id));
      setSelectedGroups((prev) => prev.filter((row) => !remove.has(row.id)));
      return;
    }
    setSelectedGroups((prev) => {
      const byId = new Map(prev.map((row) => [row.id, row]));
      for (const option of options) byId.set(option.id, option);
      return [...byId.values()];
    });
  }

  function clearVisibleGroups(options) {
    const remove = new Set(options.map((option) => option.id));
    setSelectedGroups((prev) => prev.filter((row) => !remove.has(row.id)));
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

  function openSaveDialog() {
    setSaveLabel(buildSuggestedLabel());
    setSaveDialogOpen(true);
  }

  async function confirmSaveSearch() {
    setMessage(null);
    const label = saveLabel.trim() || buildSuggestedLabel();
    try {
      await request("/api/v1/me/saved-searches/", {
        method: "POST",
        body: {
          label,
          q,
          municipalities: selectedMunicipalities.map((row) => row.id),
          groups: selectedGroups.map((row) => row.id),
          remote,
          match_cv: matchCvOnly,
        },
      });
      setMessage(`Sökningen "${label}" sparades.`);
      setSaveDialogOpen(false);
      loadSavedSearches();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function applySavedSearch(saved) {
    setQ(saved.q || "");
    setRemote(!!saved.remote);
    setMatchCvOnly(!!saved.match_cv);
    setSelectedMunicipalities(
      (saved.municipalities ?? []).map((id) => ({ id, label: id }))
    );
    setSelectedGroups((saved.groups ?? []).map((id) => ({ id, label: id })));
    requestResultsScroll();
    setOffset(0);
    setQuery({
      q: saved.q || "",
      municipalities: (saved.municipalities ?? []).map((id) => ({ id, label: id })),
      groups: (saved.groups ?? []).map((id) => ({ id, label: id })),
      remote: !!saved.remote,
      matchCv: !!saved.match_cv,
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

  function openRenameDialog(saved) {
    setRenameTarget(saved);
    setRenameLabel(buildSearchLabel(saved));
  }

  async function confirmRenameSearch() {
    if (!renameTarget) return;
    const label = renameLabel.trim();
    if (!label) return;
    try {
      await request(`/api/v1/me/saved-searches/${renameTarget.id}/`, {
        method: "PATCH",
        body: { label },
      });
      setRenameTarget(null);
      loadSavedSearches();
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
  const locationSummary = countSummary(
    selectedMunicipalities.length,
    "ort",
    "orter"
  );
  const occupationSummary = countSummary(selectedGroups.length, "yrke", "yrken");
  const activeFilters =
    query.q ||
    query.municipalities.length ||
    query.groups.length ||
    query.remote ||
    query.matchCv;
  const canSave =
    q ||
    selectedMunicipalities.length ||
    selectedGroups.length ||
    remote ||
    matchCvOnly;
  const municipalityOptions = municipalityCache[browseRegion] ?? [];
  const groupOptions = groupCache[browseField] ?? [];

  return (
    <div className="stack">
      <section className="command-hero command-hero--compact">
        <div className="command-hero-copy">
          <span className="section-kicker">Platsbanken</span>
          <h2>Sök jobb</h2>
          <p className="muted">
            Platsbanken — filtrera på ort och yrke, spara det du vill söka på
            tavlan.
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
        <form className="job-search job-search--advanced" onSubmit={submit}>
          <input
            className="job-search-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök yrke, företag, kompetens…"
            aria-label="Sökord"
          />

          <MultiSelectFilter
            triggerLabel="Ort"
            summary={locationSummary}
            primaryTitle="Län"
            secondaryTitle="Kommuner"
            primaryOptions={filters.regions}
            secondaryOptions={municipalityOptions}
            activePrimaryId={browseRegion}
            onActivePrimaryChange={setBrowseRegion}
            selectedIds={selectedMunicipalities.map((row) => row.id)}
            onToggleSecondary={toggleMunicipality}
            onSelectAllSecondary={selectAllMunicipalities}
            onClearSecondary={() => clearVisibleMunicipalities(municipalityOptions)}
            secondaryLoading={municipalitiesLoading && !municipalityCache[browseRegion]}
          />

          <MultiSelectFilter
            triggerLabel="Yrke"
            summary={occupationSummary}
            primaryTitle="Yrkesområden"
            secondaryTitle="Yrken"
            primaryOptions={filters.fields}
            secondaryOptions={groupOptions}
            activePrimaryId={browseField}
            onActivePrimaryChange={setBrowseField}
            selectedIds={selectedGroups.map((row) => row.id)}
            onToggleSecondary={toggleGroup}
            onSelectAllSecondary={selectAllGroups}
            onClearSecondary={() => clearVisibleGroups(groupOptions)}
            secondaryLoading={groupsLoading && !groupCache[browseField]}
            secondaryEmptyText="Välj yrkesområde till vänster"
          />

          <label
            className="job-remote"
            title="Visa bara jobb som kan utföras på distans"
          >
            <input
              type="checkbox"
              checked={remote}
              onChange={(e) => setRemote(e.target.checked)}
            />
            Endast distans
          </label>

          <label
            className="job-remote"
            title="Kräver CV med kompetenser — visar jobb där minst 40% matchar"
          >
            <input
              type="checkbox"
              checked={matchCvOnly}
              onChange={(e) => setMatchCvOnly(e.target.checked)}
            />
            Passar mitt CV
          </label>

          <button type="submit" className="job-search-submit">
            Sök
          </button>
        </form>

        <div className="saved-search-tools">
          <button
            type="button"
            className="secondary small"
            onClick={openSaveDialog}
            disabled={!canSave}
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
                    className="saved-search-edit"
                    onClick={() => openRenameDialog(saved)}
                    aria-label={`Byt namn på ${buildSearchLabel(saved)}`}
                  >
                    ✎
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
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}

        <section
          ref={resultsSectionRef}
          className="job-results"
          aria-label="Sökresultat"
        >
          {loading && (
            <div className="loading-row">
              <span className="spinner" /> Söker i Platsbanken…
            </div>
          )}

          {!error && (
            <p className="muted job-count">
              {loading && total > 0
                ? `Laddar sida ${Math.floor(offset / PAGE_SIZE) + 1}…`
                : total === 0
                  ? query.matchCv
                    ? "Inga annonser matchade ditt CV i denna sökning."
                    : "Inga annonser matchade din sökning."
                  : query.matchCv
                    ? `Visar ${results.length} som passar CV:t (${showingFrom}–${showingTo} av ${total.toLocaleString(
                        "sv-SE"
                      )})`
                    : `Visar ${showingFrom}–${showingTo} av ${total.toLocaleString(
                        "sv-SE"
                      )} annonser`}
              {!loading && activeFilters && (
                <button className="linklike job-clear" onClick={clearFilters}>
                  Rensa filter
                </button>
              )}
            </p>
          )}

          <div
            className={loading ? "job-list job-list--loading" : "job-list"}
            aria-busy={loading}
          >
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
        </section>

        {total > PAGE_SIZE && (
          <div className="pager">
            <button
              className="secondary small"
              disabled={offset === 0 || loading}
              onClick={() => goToPage(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Föregående
            </button>
            <button
              className="secondary small"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => goToPage(offset + PAGE_SIZE)}
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

        {saveDialogOpen && (
          <SaveSearchDialog
            label={saveLabel}
            onLabelChange={setSaveLabel}
            onCancel={() => setSaveDialogOpen(false)}
            onSave={confirmSaveSearch}
          />
        )}

        {renameTarget && (
          <SaveSearchDialog
            title="Byt namn på sökning"
            label={renameLabel}
            onLabelChange={setRenameLabel}
            onCancel={() => setRenameTarget(null)}
            onSave={confirmRenameSearch}
            saveText="Spara namn"
          />
        )}
      </section>
    </div>
  );
}

function SaveSearchDialog({
  title = "Spara sökning",
  label,
  onLabelChange,
  onCancel,
  onSave,
  saveText = "Spara",
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector("input")?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onCancel]);

  return (
    <ModalOverlay
      onClose={onCancel}
      className="modal save-search-modal"
      dialogRef={dialogRef}
      labelledBy="save-search-title"
    >
      <div className="modal-head">
        <div className="modal-head-text">
          <h2 id="save-search-title">{title}</h2>
          <p className="muted">Ge sökningen ett namn du känner igen.</p>
        </div>
        <button
          type="button"
          className="secondary small modal-close"
          onClick={onCancel}
          aria-label="Stäng"
        >
          ✕
        </button>
      </div>
      <label className="stack-tight">
        <span className="field-label">Namn</span>
        <input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          maxLength={120}
          placeholder="t.ex. Python distans Stockholm"
        />
      </label>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Avbryt
        </button>
        <button type="button" className="btn-primary" onClick={onSave}>
          {saveText}
        </button>
      </div>
    </ModalOverlay>
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
    if (job.match?.missing?.length) {
      recordJobMatchGaps(job.match.missing);
    }
  }, [job.match]);

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
