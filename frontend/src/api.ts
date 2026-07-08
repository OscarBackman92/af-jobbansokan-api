// Thin fetch wrapper. Paths are same-origin (Vite proxies to Django).
//
// Authenticated calls read the access token from storage and retry once
// after a transparent token refresh on 401, so a 15-minute access token
// never interrupts the user mid-task. Pass { auth: false } for the
// public login/registration calls.

import { clearTokens, getAccess, refreshAccess } from "./auth.js";

type ErrorBody = Record<string, unknown> | null;

export type RequestOptions = {
  method?: string;
  apiKey?: string;
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  body: ErrorBody;

  constructor(status: number, body: ErrorBody) {
    super(formatErrors(body) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function formatErrors(body: ErrorBody): string {
  if (!body || typeof body !== "object") return String(body ?? "");
  return Object.entries(body)
    .map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(" ") : String(msgs);
      return field === "detail" || field === "non_field_errors"
        ? text
        : `${field}: ${text}`;
    })
    .join(" — ");
}

type SendOptions = {
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  isForm: boolean;
  accessToken: string | null;
};

async function send(
  path: string,
  { method, headers, body, isForm, accessToken }: SendOptions
): Promise<Response> {
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return fetch(path, {
    method,
    headers: { ...headers },
    body: isForm ? (body as BodyInit) : body ? JSON.stringify(body) : undefined,
  });
}

export async function request<T = unknown>(
  path: string,
  { method = "GET", apiKey, body, auth = true }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (apiKey) headers["Authorization"] = `Api-Key ${apiKey}`;

  const accessToken = auth && !apiKey ? getAccess() : null;
  let response = await send(path, { method, headers, body, isForm, accessToken });

  // Access token likely expired — refresh once and retry transparently.
  if (response.status === 401 && auth && !apiKey) {
    const fresh = await refreshAccess();
    if (fresh) {
      response = await send(path, {
        method,
        headers,
        body,
        isForm,
        accessToken: fresh,
      });
    } else {
      clearTokens();
      window.dispatchEvent(new Event("auth-expired"));
    }
  }

  if (response.status === 204) return null as T;
  const data = (await response.json().catch(() => null)) as ErrorBody;
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

// Authenticated file download (CSV export) — same refresh-on-401 path,
// but returns a Blob rather than JSON.
export async function downloadBlob(path: string): Promise<Blob> {
  let response = await fetch(path, {
    headers: { Authorization: `Bearer ${getAccess()}` },
  });
  if (response.status === 401) {
    const fresh = await refreshAccess();
    if (!fresh) {
      clearTokens();
      window.dispatchEvent(new Event("auth-expired"));
      throw new ApiError(401, { detail: "Sessionen har gått ut." });
    }
    response = await fetch(path, {
      headers: { Authorization: `Bearer ${fresh}` },
    });
  }
  if (!response.ok) throw new ApiError(response.status, null);
  return response.blob();
}
