import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { addEvidenceTerm, coverGapInMatch } from "../addEvidence.js";
import { externalUrl, normalizeAdUrl } from "../adUrl.js";
import { request } from "../api.js";
import { recordJobMatchGaps } from "../marketHints.js";
import MatchScore from "./MatchScore.jsx";
import ModalOverlay from "./ModalOverlay.jsx";
import MultiSelectFilter from "./MultiSelectFilter.jsx";
import ProfileFitRow from "./ProfileFitRow.jsx";

const LAST_SEARCH_KEY = "jobbdjungeln-last-job-search";
const LAST_MUNICIPALITIES_KEY = "jobbdjungeln-last-municipalities";
const LAST_REGION_KEY = "jobbdjungeln-last-region";

function readLastMunicipalities() {
  try {
    const raw = localStorage.getItem(LAST_MUNICIPALITIES_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.filter((row) => row?.id) : [];
  } catch {
    return [];
  }
}

function rememberMunicipalities(rows, regionId) {
  try {
    localStorage.setItem(LAST_MUNICIPALITIES_KEY, JSON.stringify(rows.slice(0, 12)));
    if (regionId) localStorage.setItem(LAST_REGION_KEY, regionId);
  } catch {
    /* ignore quota */
  }
}

function readLastSearch() {
  try {
    const raw = sessionStorage.getItem(LAST_SEARCH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      q: typeof data.q === "string" ? data.q : "",
      municipalities: Array.isArray(data.municipalities)
        ? data.municipalities.filter((row) => row?.id)
        : [],
      groups: Array.isArray(data.groups) ? data.groups.filter((row) => row?.id) : [],
      remote: !!data.remote,
      matchCv: !!data.matchCv,
      minMatch60: !!data.minMatch60,
      sortMatch: !!data.sortMatch,
      hideBlocked: !!data.hideBlocked,
    };
  } catch {
    return null;
  }
}

function rememberSearch(search) {
  try {
    sessionStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(search));
  } catch {
    /* ignore quota */
  }
}

function clearRememberedSearch() {
  try {
    sessionStorage.removeItem(LAST_SEARCH_KEY);
  } catch {
    /* ignore */
  }
}

const PAGE_SIZE = 25;

const EMPTY_QUERY = {
  q: "",
  municipalities: [],
  groups: [],
  remote: false,
  matchCv: false,
  minMatch60: false,
  sortMatch: false,
  hideBlocked: false,
};

function initialQuery() {
  try {
    const pending = sessionStorage.getItem("jobbdjungeln-pending-job-q");
    if (pending) {
      sessionStorage.removeItem("jobbdjungeln-pending-job-q");
      return { ...EMPTY_QUERY, q: pending };
    }
  } catch {
    /* ignore */
  }
  const saved = readLastSearch();
  if (saved) return saved;
  const municipalities = readLastMunicipalities();
  if (!municipalities.length) return EMPTY_QUERY;
  return { ...EMPTY_QUERY, municipalities };
}

function readOffsetFromUrl() {
  const page = Number.parseInt(
    new URLSearchParams(window.location.search).get("page") || "1",
    10
  );
  if (!Number.isFinite(page) || page < 1) return 0;
  return (page - 1) * PAGE_SIZE;
}

function syncPageToUrl(nextOffset) {
  const params = new URLSearchParams(window.location.search);
  const page = Math.floor(nextOffset / PAGE_SIZE) + 1;
  const current = params.get("page");
  if (page <= 1) {
    if (!current) return;
    params.delete("page");
  } else if (current === String(page)) {
    return;
  } else {
    params.set("page", String(page));
  }
  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState(null, "", url);
}

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

export default function PostingsPanel({ onNavigate, active = true }) {
  const [filters, setFilters] = useState({ regions: [], fields: [] });
  const [q, setQ] = useState(() => initialQuery().q ?? "");
  const [browseRegion, setBrowseRegion] = useState(
    () => localStorage.getItem(LAST_REGION_KEY) || ""
  );
  const [browseField, setBrowseField] = useState("");
  const [selectedMunicipalities, setSelectedMunicipalities] = useState(
    () => readLastSearch()?.municipalities ?? readLastMunicipalities()
  );
  const [selectedGroups, setSelectedGroups] = useState(
    () => readLastSearch()?.groups ?? []
  );
  const [municipalityCache, setMunicipalityCache] = useState({});
  const [groupCache, setGroupCache] = useState({});
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [filtersError, setFiltersError] = useState(null);
  const [remote, setRemote] = useState(() => readLastSearch()?.remote ?? false);
  const [matchCvOnly, setMatchCvOnly] = useState(
    () => readLastSearch()?.matchCv ?? false
  );
  const [minMatch60, setMinMatch60] = useState(
    () => readLastSearch()?.minMatch60 ?? false
  );
  const [sortMatch, setSortMatch] = useState(
    () => readLastSearch()?.sortMatch ?? false
  );
  const [hideBlocked, setHideBlocked] = useState(
    () => readLastSearch()?.hideBlocked ?? false
  );
  const [query, setQuery] = useState(initialQuery);
  const [offset, setOffset] = useState(() => readOffsetFromUrl());
  const resultsSectionRef = useRef(null);
  const pendingScrollRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    try {
      const pending = sessionStorage.getItem("jobbdjungeln-pending-job-q");
      if (!pending) return;
      sessionStorage.removeItem("jobbdjungeln-pending-job-q");
      setQ(pending);
      const next = { ...EMPTY_QUERY, q: pending };
      rememberSearch(next);
      setQuery(next);
      syncPageToUrl(0);
      setOffset(0);
    } catch {
      /* ignore */
    }
  }, [active]);

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
  const [activeSavedId, setActiveSavedId] = useState(null);

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
    if (!active) return undefined;
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
  }, [active, loadSavedSearches]);

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
      if (query.minMatch60) params.set("min_match", "60");
      else if (query.matchCv) params.set("match_cv", "true");
      if (query.sortMatch) params.set("sort", "match");
      if (query.hideBlocked) params.set("hide_blocked", "1");
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
    if (!active) return;
    runSearch();
  }, [active, runSearch]);

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
    syncPageToUrl(nextOffset);
    setOffset(nextOffset);
  }

  function resetToFirstPage() {
    syncPageToUrl(0);
    setOffset(0);
  }

  function submit(event) {
    event.preventDefault();
    requestResultsScroll();
    resetToFirstPage();
    rememberMunicipalities(selectedMunicipalities, browseRegion);
    const next = {
      q,
      municipalities: selectedMunicipalities,
      groups: selectedGroups,
      remote,
      matchCv: matchCvOnly,
      minMatch60,
      sortMatch,
      hideBlocked,
    };
    rememberSearch(next);
    setActiveSavedId(null);
    setQuery(next);
  }

  function clearFilters() {
    setQ("");
    setSelectedMunicipalities([]);
    setSelectedGroups([]);
    setRemote(false);
    setMatchCvOnly(false);
    setMinMatch60(false);
    setSortMatch(false);
    setHideBlocked(false);
    clearRememberedSearch();
    try {
      localStorage.removeItem(LAST_MUNICIPALITIES_KEY);
    } catch {
      /* ignore */
    }
    requestResultsScroll();
    resetToFirstPage();
    setActiveSavedId(null);
    setQuery(EMPTY_QUERY);
  }

  function clearMatchCvFilter() {
    setMatchCvOnly(false);
    setMinMatch60(false);
    const next = { ...query, matchCv: false, minMatch60: false };
    rememberSearch(next);
    requestResultsScroll();
    resetToFirstPage();
    setActiveSavedId(null);
    setQuery(next);
  }

  function clearSearchText() {
    setQ("");
    if (!query.q) return;
    const next = { ...query, q: "" };
    rememberSearch(next);
    rememberMunicipalities(next.municipalities, browseRegion);
    requestResultsScroll();
    resetToFirstPage();
    setActiveSavedId(null);
    setQuery(next);
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
      const applyUrl = externalUrl(job.application_url || "") || "";
      await request("/api/v1/applications/", {
        method: "POST",
        body: {
          company: job.company_name || "Okänt företag",
          title: job.title,
          location: job.location,
          ad_url: job.webpage_url,
          apply_url: applyUrl,
          ad_description: job.description || "",
          source_job_id: job.id || "",
          source: "platsbanken",
          deadline: job.application_deadline,
          status: "wishlist",
        },
      });
      if (job.webpage_url) {
        setTracked((prev) => new Set(prev).add(normalizeAdUrl(job.webpage_url)));
      }
      setMessage(`"${job.title}" sparades som Sparad.`);
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
    syncPageToUrl(0);
    setOffset(0);
    setActiveSavedId(saved.id);
    setQuery({
      q: saved.q || "",
      municipalities: (saved.municipalities ?? []).map((id) => ({ id, label: id })),
      groups: (saved.groups ?? []).map((id) => ({ id, label: id })),
      remote: !!saved.remote,
      matchCv: !!saved.match_cv,
    });
    rememberSearch({
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

  const total = error ? null : (data?.total ?? (loading ? null : 0));
  const totalLabel =
    total == null ? "—" : total.toLocaleString("sv-SE");
  // Keep JobTech order (pubdate-desc) so pages stay stable; do not re-sort.
  // Dedupe within the page in case upstream returns the same id twice.
  const results = (() => {
    const rows = data?.results ?? [];
    const seen = new Set();
    return rows.filter((job) => {
      const id = job?.id;
      if (id == null) return true;
      const key = String(id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  const safeTotal = total ?? 0;
  const showingFrom = safeTotal === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, safeTotal);
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(safeTotal / PAGE_SIZE));
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
            Platsbanken — filtrera på ort och yrke, spara ansökningar du vill följa upp.
          </p>
        </div>
        <div className="metric-inline" aria-label="Söksammanfattning">
          <div className="metric-tile metric-tile--cyan">
            <span className="metric-label">Träffar</span>
            <strong>{totalLabel}</strong>
            <span className="metric-detail">i sökningen</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Spårade</span>
            <strong>{tracked.size}</strong>
            <span className="metric-detail">redan i listan</span>
          </div>
        </div>
      </section>

      <section className="card">
        <form className="job-search job-search--advanced" onSubmit={submit}>
          <div className="job-search-q-wrap">
            <input
              className="job-search-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök från början av ord: yrke, företag, ort…"
              aria-label="Sökord"
            />
            {q && (
              <button
                type="button"
                className="job-search-q-clear"
                onClick={clearSearchText}
                aria-label="Rensa sökord"
              >
                ✕
              </button>
            )}
          </div>

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
            onClearAll={() => setSelectedMunicipalities([])}
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
            onClearAll={() => setSelectedGroups([])}
            secondaryLoading={groupsLoading && !groupCache[browseField]}
            secondaryEmptyText="Välj yrkesområde till vänster"
          />

          <label
            className={`job-filter-chip ${remote ? "active" : ""}`}
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
            className={`job-filter-chip ${matchCvOnly ? "active" : ""}`}
            title="Visa jobb där minst ett krav från annonsen täcks av CV:t"
          >
            <input
              type="checkbox"
              checked={matchCvOnly}
              onChange={(e) => {
                setMatchCvOnly(e.target.checked);
                if (e.target.checked) setMinMatch60(false);
              }}
            />
            Passar mitt CV
          </label>

          <label
            className={`job-filter-chip ${minMatch60 ? "active" : ""}`}
            title="Visa bara jobb med minst 60 % kravtäckning"
          >
            <input
              type="checkbox"
              checked={minMatch60}
              onChange={(e) => {
                setMinMatch60(e.target.checked);
                if (e.target.checked) setMatchCvOnly(false);
              }}
            />
            Minst 60 % kravtäckning
          </label>

          <label
            className={`job-filter-chip ${sortMatch ? "active" : ""}`}
            title="Sortera träffarna på kravtäckning"
          >
            <input
              type="checkbox"
              checked={sortMatch}
              onChange={(e) => setSortMatch(e.target.checked)}
            />
            Sortera: kravtäckning
          </label>

          <label
            className={`job-filter-chip ${hideBlocked ? "active" : ""}`}
            title="Dölj annonser med hårda formella blockerare"
          >
            <input
              type="checkbox"
              checked={hideBlocked}
              onChange={(e) => setHideBlocked(e.target.checked)}
            />
            Dölj blockerare
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
                <span
                  className={
                    activeSavedId === saved.id
                      ? "saved-search-chip saved-search-chip--active"
                      : "saved-search-chip"
                  }
                  key={saved.id}
                >
                  <button
                    type="button"
                    aria-pressed={activeSavedId === saved.id}
                    onClick={() => applySavedSearch(saved)}
                  >
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
        {error && (
          <div className="error-block" role="alert">
            <p className="error">{error}</p>
            <div className="error-actions">
              {/kompetens/i.test(error) && (
                <>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => onNavigate?.("profile", { focus: "skills" })}
                  >
                    Öppna Profil &amp; CV
                  </button>
                  <button
                    type="button"
                    className="linklike"
                    onClick={clearMatchCvFilter}
                  >
                    Rensa filter
                  </button>
                </>
              )}
            </div>
          </div>
        )}

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

          {!loading && !error && (
            <p className="muted job-count">
              {safeTotal === 0
                ? query.minMatch60 || query.matchCv
                  ? `Inga av de ${Number(data?.scanned ?? data?.match_cv_scanned ?? 0).toLocaleString("sv-SE") || "—"} genomsökta annonserna nådde filtret.`
                  : "Inga annonser matchade din sökning."
                : query.minMatch60 || query.matchCv
                  ? `Visar ${showingFrom}–${showingTo} av ${totalLabel} som når kravtäckningen${
                      data?.scanned || data?.match_cv_scanned
                        ? ` — sökte igenom de ${Number(
                            data.scanned ?? data.match_cv_scanned
                          ).toLocaleString("sv-SE")} senaste`
                        : ""
                    }${data?.truncated ? " (avbrutet efter budget)" : ""}`
                  : `Visar ${showingFrom}–${showingTo} av ${totalLabel} annonser`}
              {activeFilters && (
                <button className="linklike job-clear" onClick={clearFilters}>
                  Rensa filter
                </button>
              )}
            </p>
          )}

          {!loading && error && (
            <p className="muted job-count">—</p>
          )}

          {!error && !loading && safeTotal === 0 && (query.matchCv || query.minMatch60) && (
            <div className="empty-actions empty-actions--inline">
              <button
                type="button"
                className="secondary small"
                onClick={() => onNavigate?.("profile", { focus: "skills" })}
              >
                Justera kompetenser
              </button>
              <button
                type="button"
                className="secondary small"
                onClick={clearMatchCvFilter}
              >
                Stäng CV-filter
              </button>
            </div>
          )}

          {!loading && !error && (
          <div
            className="job-list"
            aria-busy={false}
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
          )}
        </section>

        {safeTotal > PAGE_SIZE && (
          <div className="pager" aria-label="Paginering">
            <button
              type="button"
              className="secondary small"
              disabled={offset === 0 || loading}
              onClick={() => goToPage(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Föregående
            </button>
            <span className="pager-status" aria-live="polite">
              Sida {pageNumber} av {pageCount.toLocaleString("sv-SE")}
            </span>
            <button
              type="button"
              className="secondary small"
              disabled={offset + PAGE_SIZE >= safeTotal || loading}
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
            onMatchUpdate={(nextMatch) => {
              setSelected((prev) =>
                prev ? { ...prev, match: nextMatch } : prev
              );
              setData((prev) => {
                if (!prev?.results) return prev;
                return {
                  ...prev,
                  results: prev.results.map((job) =>
                    job.id === selected.id ? { ...job, match: nextMatch } : job
                  ),
                };
              });
            }}
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
  const blocked = (job.match?.formal || []).some((row) => row.ok === false);
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
          {blocked && (
            <span className="badge rejected" title="Formellt krav saknas">
              Blockerare
            </span>
          )}
          {job.application_deadline && (
            <span className="badge neutral">
              Sista ansökningsdag {job.application_deadline}
            </span>
          )}
          {job.match && <MatchScore match={job.match} variant="compact" />}
          {job.match?.profiles_scored && (
            <ProfileFitRow profiles={job.match.profiles_scored} />
          )}
        </div>
      </div>
      <button
        className="secondary small job-track"
        onClick={onTrack}
        disabled={tracked}
      >
        {tracked ? "Sparad ✓" : "+ Spara"}
      </button>
    </div>
  );
}

function JobDetail({ job, tracked, onTrack, onClose, onMatchUpdate }) {
  const dialogRef = useRef(null);
  const applyHref =
    externalUrl(job.application_url) || externalUrl(job.webpage_url);
  const platsbankenHref = externalUrl(job.webpage_url);

  useEffect(() => {
    const gaps = job.match?.gaps?.length
      ? job.match.gaps.map((g) => g.term)
      : job.match?.missing;
    if (gaps?.length) {
      recordJobMatchGaps(gaps);
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

  async function handleAddEvidence(gap) {
    try {
      await addEvidenceTerm(gap.term);
      const nextMatch = coverGapInMatch(job.match, gap);
      onMatchUpdate?.(nextMatch);
    } catch {
      /* keep gap visible */
    }
  }

  return (
    <ModalOverlay
      onClose={onClose}
      className="modal job-modal"
      overlayClassName="overlay overlay--job"
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
        {applyHref && (
          <a
            className="btn-primary"
            href={applyHref}
            target="_blank"
            rel="noreferrer"
          >
            {job.application_url
              ? "Ansök hos arbetsgivaren ↗"
              : "Ansök på platsannonsen ↗"}
          </a>
        )}
        {platsbankenHref && platsbankenHref !== applyHref && (
          <a
            className="secondary"
            href={platsbankenHref}
            target="_blank"
            rel="noreferrer"
          >
            Platsbanken ↗
          </a>
        )}
        <button className="secondary" onClick={onTrack} disabled={tracked}>
          {tracked ? "Sparad ✓" : "+ Spara ansökan"}
        </button>
      </div>
      <p className="muted modal-hint">
        {job.application_url
          ? "Ansökan görs hos arbetsgivaren — läs annonsen här och spara ansökan för uppföljning."
          : "Ansökan görs hos arbetsgivaren — spara den här så följer du den i dina ansökningar."}
      </p>

      {job.match?.profiles_scored && (
        <ProfileFitRow profiles={job.match.profiles_scored} />
      )}
      {job.match && (
        <MatchScore
          match={job.match}
          variant="detail"
          onAddEvidence={handleAddEvidence}
        />
      )}

      <div className="description">
        {job.description || "Ingen beskrivning tillgänglig för den här annonsen."}
      </div>
    </ModalOverlay>
  );
}
