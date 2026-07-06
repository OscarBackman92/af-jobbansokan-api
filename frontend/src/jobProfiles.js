export const MAX_PROFILES = 3;

export const EVIDENCE_CATEGORIES = ["technical", "domain", "languages"];

export const CATEGORY_LABELS = {
  technical: "Verktyg & teknik",
  domain: "Metod & domän",
  languages: "Språk",
};

function newId() {
  return crypto.randomUUID().slice(0, 12);
}

export function defaultProfileLabel(headline = "") {
  const text = String(headline || "").trim();
  return text || "Mitt jobbsök";
}

export function emptyProfile({ label = "Mitt jobbsök", active = true } = {}) {
  return {
    id: newId(),
    label,
    active,
    evidence: [],
  };
}

export function normalizeJobProfiles(raw, headline = "") {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_PROFILES) : [];
  const profiles = list.map((item) => ({
    id: String(item.id || newId()),
    label: String(item.label || defaultProfileLabel(headline)).trim().slice(0, 120),
    active: Boolean(item.active),
    evidence: Array.isArray(item.evidence)
      ? item.evidence.map((row) => ({
          id: String(row.id || newId()),
          term: String(row.term || "").trim(),
          category: EVIDENCE_CATEGORIES.includes(row.category) ? row.category : "domain",
          source: {
            type: row.source?.type || "manual",
            index: typeof row.source?.index === "number" ? row.source.index : null,
            label: String(row.source?.label || "").trim(),
          },
          confirmed: row.confirmed !== false,
        }))
      : [],
  }));

  if (!profiles.length) {
    profiles.push(emptyProfile({ label: defaultProfileLabel(headline), active: true }));
  }

  const activeCount = profiles.filter((profile) => profile.active).length;
  if (activeCount !== 1) {
    profiles.forEach((profile, index) => {
      profile.active = index === 0;
    });
  }

  const seen = new Set();
  for (const profile of profiles) {
    profile.evidence = profile.evidence.filter((item) => {
      const key = item.term.toLowerCase();
      if (!item.term || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return profiles;
}

export function activeProfile(profiles) {
  return profiles.find((profile) => profile.active) || profiles[0];
}

export function confirmedEvidence(profile) {
  return (profile?.evidence ?? []).filter((item) => item.confirmed && item.term);
}

export function profileHasEvidence(profile) {
  return confirmedEvidence(profile).length > 0;
}

export function anyProfileHasEvidence(profiles) {
  return profiles.some((profile) => profileHasEvidence(profile));
}

export function setActiveProfile(profiles, profileId) {
  return profiles.map((profile) => ({
    ...profile,
    active: profile.id === profileId,
  }));
}

export function addProfile(profiles, label) {
  if (profiles.length >= MAX_PROFILES) return profiles;
  const inactive = profiles.map((profile) => ({ ...profile, active: false }));
  return [
    ...inactive,
    emptyProfile({ label: label || `Profil ${profiles.length + 1}`, active: true }),
  ];
}

export function updateProfileLabel(profiles, profileId, label) {
  return profiles.map((profile) =>
    profile.id === profileId ? { ...profile, label: label.trim().slice(0, 120) } : profile
  );
}

export function experienceSourceLabel(index, row) {
  const title = String(row?.title || "").trim();
  return title ? `Erfarenhet ${index + 1}: ${title}` : `Erfarenhet ${index + 1}`;
}

export function educationSourceLabel(index, row) {
  const label = String(row?.degree || row?.school || "").trim();
  return label ? `Utbildning ${index + 1}: ${label}` : `Utbildning ${index + 1}`;
}

export function addEvidence(profile, { term, category, source }) {
  const text = String(term || "").trim();
  if (!text) return profile;
  const lowered = text.toLowerCase();
  const evidence = [];
  let replaced = false;
  for (const item of profile.evidence) {
    if (item.term.toLowerCase() === lowered) {
      evidence.push({
        ...item,
        term: text,
        category,
        source,
        confirmed: true,
      });
      replaced = true;
    } else {
      evidence.push(item);
    }
  }
  if (!replaced) {
    evidence.push({
      id: newId(),
      term: text,
      category,
      source,
      confirmed: true,
    });
  }
  return { ...profile, evidence };
}

export function removeEvidence(profile, term) {
  const lowered = String(term || "").toLowerCase();
  return {
    ...profile,
    evidence: profile.evidence.filter((item) => item.term.toLowerCase() !== lowered),
  };
}

export function applyEvidenceToProfiles(profiles, profileId, updater) {
  return profiles.map((profile) =>
    profile.id === profileId ? updater(profile) : profile
  );
}

export function evidenceByLabel(profile, label) {
  return profile.evidence.filter((item) => item.source?.label === label);
}

export function evidenceForSource(profile, sourceKey) {
  const [type, indexRaw] = sourceKey.split(":");
  const index = indexRaw === undefined ? null : Number(indexRaw);
  return profile.evidence.filter((item) => {
    const source = item.source || {};
    if (source.type !== type) return false;
    if (type === "manual" || type === "cv_section") return source.type === type;
    return source.index === index;
  });
}

export function groupEvidenceBySource(profile) {
  const groups = new Map();
  for (const item of confirmedEvidence(profile)) {
    const source = item.source || {};
    let key = "manual";
    if (source.type === "experience" && typeof source.index === "number") {
      key = `experience:${source.index}`;
    } else if (source.type === "education" && typeof source.index === "number") {
      key = `education:${source.index}`;
    } else if (source.label) {
      key = source.label;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

export function countSuggestions(bySource) {
  if (!bySource) return 0;
  return Object.values(bySource).reduce((total, items) => total + (items?.length ?? 0), 0);
}

export function removeSuggestion(bySource, sourceKey, term) {
  if (!bySource?.[sourceKey]) return bySource;
  const lowered = term.toLowerCase();
  return {
    ...bySource,
    [sourceKey]: bySource[sourceKey].filter((item) => item.term.toLowerCase() !== lowered),
  };
}
