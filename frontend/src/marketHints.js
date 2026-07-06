const STORAGE_KEY = "jobbsoket.marketHints";

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function recordJobMatchGaps(missingTerms) {
  if (!Array.isArray(missingTerms) || !missingTerms.length) return;
  const store = readStore();
  for (const term of missingTerms) {
    const text = String(term || "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    store[key] = (store[key] || 0) + 1;
  }
  writeStore(store);
}

export function getMarketHints(existingTerms = [], limit = 8) {
  const existing = new Set(existingTerms.map((term) => String(term).toLowerCase()));
  const store = readStore();
  return Object.entries(store)
    .filter(([term]) => !existing.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => ({ term: term.charAt(0).toUpperCase() + term.slice(1), category: "domain" }));
}
