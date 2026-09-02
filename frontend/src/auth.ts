import type { AuthTokens } from "./types/app.js";

// Token storage + refresh. The access token lives ~15 min; the refresh
// token (7 days, rotating) is used to mint a new one transparently when
// a request gets a 401, so the user is not silently logged out mid-edit.
// localStorage so a reload or a new tab keeps the session. httpOnly cookies
// remain a follow-up for XSS hardening.

const ACCESS_KEY = "token"; // kept as "token" for backwards compatibility
const REFRESH_KEY = "refresh";

function readStored(key: string): string | null {
  const fromLocal = localStorage.getItem(key);
  if (fromLocal) return fromLocal;
  const fromSession = sessionStorage.getItem(key);
  if (fromSession) {
    localStorage.setItem(key, fromSession);
    sessionStorage.removeItem(key);
    return fromSession;
  }
  return null;
}

export function getAccess(): string | null {
  return readStored(ACCESS_KEY);
}

export function getRefresh(): string | null {
  return readStored(REFRESH_KEY);
}

export function setTokens({ access, refresh }: Partial<AuthTokens>): void {
  if (access) {
    localStorage.setItem(ACCESS_KEY, access);
    sessionStorage.removeItem(ACCESS_KEY);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
    sessionStorage.removeItem(REFRESH_KEY);
  }
}

export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function logout(): Promise<void> {
  const refresh = getRefresh();
  const access = getAccess();
  try {
    if (refresh) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (access) {
        headers.Authorization = `Bearer ${access}`;
      }
      await fetch("/dj-rest-auth/logout/", {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh }),
      });
    }
  } catch {
    // Best-effort: local logout must succeed even if the server is down.
  } finally {
    clearTokens();
  }
}

type RefreshResponse = {
  access?: string;
  refresh?: string;
};

export type RefreshResult =
  | { ok: true; access: string }
  | { ok: false; reason: "missing" | "expired" | "transient" };

function isExpiredRefreshStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

// Exchange the refresh token for a fresh access token. With rotation on,
// the server also returns a new refresh token; persist both. Concurrent
// callers share one in-flight request so we never double-refresh.
let inFlight: Promise<RefreshResult> | null = null;

export function refreshAccess(): Promise<RefreshResult> {
  if (inFlight) return inFlight;
  const refresh = getRefresh();
  if (!refresh) return Promise.resolve({ ok: false, reason: "missing" });

  inFlight = fetch("/dj-rest-auth/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
    .then(async (response): Promise<RefreshResult> => {
      if (response.ok) {
        const data = (await response.json()) as RefreshResponse;
        if (data?.access) {
          setTokens({ access: data.access, refresh: data.refresh });
          return { ok: true, access: data.access };
        }
        return { ok: false, reason: "transient" };
      }
      if (isExpiredRefreshStatus(response.status)) {
        clearTokens();
        return { ok: false, reason: "expired" };
      }
      return { ok: false, reason: "transient" };
    })
    .catch((): RefreshResult => ({ ok: false, reason: "transient" }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
