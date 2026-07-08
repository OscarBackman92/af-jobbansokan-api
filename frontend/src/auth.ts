import type { AuthTokens } from "./types/app.js";

// Token storage + refresh. The access token lives ~15 min; the refresh
// token (7 days, rotating) is used to mint a new one transparently when
// a request gets a 401, so the user is not silently logged out mid-edit.

const ACCESS_KEY = "token"; // kept as "token" for backwards compatibility
const REFRESH_KEY = "refresh";

export function getAccess(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ access, refresh }: Partial<AuthTokens>): void {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
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
