// Thin fetch wrapper. Paths are same-origin (Vite proxies to Django).
//
// Authenticated calls read the access token from storage and retry once
// after a transparent token refresh on 401, so a 15-minute access token
// never interrupts the user mid-task. Pass { auth: false } for the
// public login/registration calls.

import { clearTokens, getAccess, refreshAccess } from "./auth.js";

export class ApiError extends Error {
  constructor(status, body) {
    super(formatErrors(body) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function formatErrors(body) {
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

async function send(path, { method, headers, body, isForm, accessToken }) {
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return fetch(path, {
    method,
    headers: { ...headers },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
}

export async function request(
  path,
  { method = "GET", apiKey, body, auth = true } = {}
) {
  const headers = {};
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

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

// Authenticated file download (CSV export) — same refresh-on-401 path,
// but returns a Blob rather than JSON.
export async function downloadBlob(path) {
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
