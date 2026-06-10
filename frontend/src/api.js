// Thin fetch wrapper. Paths are same-origin (Vite proxies to Django).

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

export async function request(path, { method = "GET", token, apiKey, body } = {}) {
  const headers = {};
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (apiKey) headers["Authorization"] = `Api-Key ${apiKey}`;

  const response = await fetch(path, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
