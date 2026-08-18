import { useCallback, useEffect, useState } from "react";

import { request } from "./api.js";

/** Merge a mutation response into an existing list row without dropping match. */
export function mergeApplicationRow(prev, row) {
  if (!prev) return row;
  const lastActivity = [row.last_activity_at, prev.last_activity_at]
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    ...prev,
    ...row,
    match: row.match ?? prev.match,
    last_activity_at: lastActivity || prev.last_activity_at,
  };
}

/**
 * Shared application list for Sparade jobb / Ansökningar.
 * One fetch, shared patches — a status change on one page updates the other.
 */
export default function useApplications(token) {
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) {
      setApplications(null);
      return;
    }
    try {
      setError(null);
      // One big page covers realistic trackers; the loop only continues past 200.
      let url = "/api/v1/applications/?page_size=200";
      const rows = [];
      while (url) {
        const page = await request(url);
        rows.push(...page.results);
        url = page.next;
      }
      setApplications(rows);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("application-created", handler);
    return () => window.removeEventListener("application-created", handler);
  }, [reload]);

  const upsert = useCallback((row) => {
    if (!row?.id) return;
    setApplications((current) => {
      if (!current) return current;
      if (row._deleted || row.archived_at) {
        return current.filter((item) => item.id !== row.id);
      }
      const index = current.findIndex((item) => item.id === row.id);
      if (index === -1) {
        return [row, ...current];
      }
      const next = [...current];
      next[index] = mergeApplicationRow(next[index], row);
      return next;
    });
  }, []);

  const patch = useCallback(async (id, body) => {
    const updated = await request(`/api/v1/applications/${id}/`, {
      method: "PATCH",
      body,
    });
    setApplications((current) => {
      if (!current) return current;
      if (updated.archived_at) {
        return current.filter((row) => row.id !== id);
      }
      return current.map((row) =>
        row.id === id ? mergeApplicationRow(row, updated) : row
      );
    });
    return updated;
  }, []);

  const bulk = useCallback(
    async ({ ids, action, date }) => {
      const body = { ids, action };
      if (date) body.date = date;
      const result = await request("/api/v1/applications/bulk/", {
        method: "POST",
        body,
      });
      // Bulk responses are ids only — reload so list serializers stay fresh.
      await reload();
      return result;
    },
    [reload]
  );

  return { applications, reload, upsert, error, setError, patch, bulk };
}
