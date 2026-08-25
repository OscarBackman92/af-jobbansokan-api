import { normalizeAdUrl } from "./adUrl.js";

export function indexTrackedUrls(payload) {
  const map = new Map();
  for (const item of payload?.items || []) {
    const key = normalizeAdUrl(item.ad_url);
    if (!key) continue;
    map.set(key, {
      id: item.id ?? null,
      status: item.status || "",
      archived: Boolean(item.archived),
      ad_url: key,
    });
  }
  if (map.size) return map;
  for (const adUrl of payload?.urls || []) {
    const key = normalizeAdUrl(adUrl);
    if (!key) continue;
    map.set(key, { id: null, status: "", archived: false, ad_url: key });
  }
  return map;
}

export function trackedItemForJob(tracked, job) {
  const key = normalizeAdUrl(job?.webpage_url || "");
  if (!key) return null;
  return tracked.get(key) || null;
}

export function isStarred(item) {
  return Boolean(item && !item.archived);
}

export function isSaveLocked(item) {
  if (!isStarred(item)) return false;
  if (!item.id) return true;
  return item.status !== "wishlist";
}
