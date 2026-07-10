const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
]);

export function normalizeAdUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return trimmed;

    url.protocol = "https:";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    }

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.href;
  } catch {
    return trimmed;
  }
}

export function externalUrl(value) {
  const normalized = normalizeAdUrl(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

export function platsbankenJobId(value) {
  const normalized = normalizeAdUrl(value) || value?.trim();
  if (!normalized) return null;

  const match =
    normalized.match(/platsbanken\/annonser\/(\d+)/i) ||
    normalized.match(/arbetsformedlingen\.se\/annons\/(\d+)/i);
  return match ? match[1] : null;
}

export function findDuplicateByAdUrl(applications, adUrl, excludeId = null) {
  const key = normalizeAdUrl(adUrl);
  if (!key) return null;

  return (
    applications.find(
      (app) =>
        app.id !== excludeId && normalizeAdUrl(app.ad_url) === key
    ) ?? null
  );
}

export function findSimilarByCompanyTitle(
  applications,
  company,
  title,
  excludeId = null
) {
  const companyKey = company?.trim().toLowerCase();
  const titleKey = title?.trim().toLowerCase();
  if (!companyKey || !titleKey) return null;

  return (
    applications.find(
      (app) =>
        app.id !== excludeId &&
        app.company?.trim().toLowerCase() === companyKey &&
        app.title?.trim().toLowerCase() === titleKey
    ) ?? null
  );
}
