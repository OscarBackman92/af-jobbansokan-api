import type { AuthTokens } from "./types/app.js";

// Token storage + refresh. The access token lives ~15 min; the refresh
// token (7 days, rotating) is used to mint a new one transparently when
// a request gets a 401, so the user is not silently logged out mid-edit.
// Stored in sessionStorage (tab-scoped); httpOnly cookies remain a follow-up.

const ACCESS_KEY = "token"; // kept as "token" for backwards compatibility
const REFRESH_KEY = "refresh";

function migrateFromLocalStorage(key: string): string | null {
  const fromSession = sessionStorage.getItem(key);
  if (fromSession) return fromSession;
  const fromLocal = localStorage.getItem(key);
  if (fromLocal) {
    sessionStorage.setItem(key, fromLocal);
    localStorage.removeItem(key);
    return fromLocal;
  }
  return null;
}

export function getAccess(): string | null {
  return migrateFromLocalStorage(ACCESS_KEY);
}

export function getRefresh(): string | null {
  return migrateFromLocalStorage(REFRESH_KEY);
}

export function setTokens({ access, refresh }: Partial<AuthTokens>): void {
  if (access) sessionStorage.setItem(ACCESS_KEY, access);
  if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

type RefreshResponse = {
  access?: string;
  refresh?: string;
};

// Exchange the refresh token for a fresh access token. With rotation on,
// the server also returns a new refresh token; persist both. Concurrent
// callers share one in-flight request so we never double-refresh.
let inFlight: Promise<string | null> | null = null;

export function refreshAccess(): Promise<string | null> {
  if (inFlight) return inFlight;
  const refresh = getRefresh();
  if (!refresh) return Promise.resolve(null);

  inFlight = fetch("/dj-rest-auth/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: RefreshResponse | null) => {
      if (data?.access) {
        setTokens({ access: data.access, refresh: data.refresh });
        return data.access;
      }
      clearTokens();
      return null;
    })
    .catch(() => {
      clearTokens();
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
