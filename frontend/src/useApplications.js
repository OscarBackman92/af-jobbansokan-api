import { useCallback, useEffect, useState } from "react";

import { request } from "./api.js";

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

  const patch = useCallback(async (id, body) => {
    const updated = await request(`/api/v1/applications/${id}/`, {
      method: "PATCH",
      body,
    });
    setApplications((current) => {
      if (!current) return current;
      // Soft-archived rows drop out of the default list.
      if (updated.archived_at) {
        return current.filter((row) => row.id !== id);
      }
      return current.map((row) =>
        row.id === id ? { ...row, ...updated } : row
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

  return { applications, reload, error, setError, patch, bulk };
}
