export const EMPTY_SKILL_GROUPS = {
  technical: [],
  domain: [],
  languages: [],
};

export const SKILL_GROUP_LABELS = {
  technical: "Verktyg & teknik",
  domain: "Metod & domän",
  languages: "Språk",
};

export const SKILL_GROUP_HINTS = {
  technical: "Python, Excel, SAP, AutoCAD",
  domain: "Agile, bokföring, projektledning, kundservice",
  languages: "Svenska, Engelska",
};

export function normalizeSkillGroups(raw) {
  const groups = { ...EMPTY_SKILL_GROUPS };
  if (!raw || typeof raw !== "object") return groups;
  for (const key of Object.keys(EMPTY_SKILL_GROUPS)) {
    const items = raw[key];
    if (Array.isArray(items)) {
      groups[key] = items.map((item) => String(item).trim()).filter(Boolean);
    }
  }
  return groups;
}

export function groupsToText(groups) {
  const normalized = normalizeSkillGroups(groups);
  return {
    technical: normalized.technical.join(", "),
    domain: normalized.domain.join(", "),
    languages: normalized.languages.join(", "),
  };
}

export function textToGroups(text) {
  const parse = (value) =>
    String(value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  return {
    technical: parse(text.technical),
    domain: parse(text.domain),
    languages: parse(text.languages),
  };
}

export function flattenSkillGroups(groups) {
  const normalized = normalizeSkillGroups(groups);
  const flat = [];
  const seen = new Set();
  for (const key of Object.keys(EMPTY_SKILL_GROUPS)) {
    for (const item of normalized[key]) {
      const lowered = item.toLowerCase();
      if (!seen.has(lowered)) {
        seen.add(lowered);
        flat.push(item);
      }
    }
  }
  return flat;
}

export function hasSkillContent(groups) {
  return flattenSkillGroups(groups).length > 0;
}

export function addSkillToText(text, label) {
  const items = String(text ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (items.some((item) => item.toLowerCase() === label.toLowerCase())) {
    return items.join(", ");
  }
  return items.length ? `${items.join(", ")}, ${label}` : label;
}

export function countSuggestions(suggestions) {
  if (!suggestions) return 0;
  return Object.values(suggestions).reduce(
    (total, items) => total + (items?.length ?? 0),
    0
  );
}

export function removeSuggestion(suggestions, category, label) {
  if (!suggestions?.[category]) return suggestions;
  return {
    ...suggestions,
    [category]: suggestions[category].filter((item) => item.label !== label),
  };
}
