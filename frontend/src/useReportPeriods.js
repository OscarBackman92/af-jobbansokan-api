import { useCallback, useEffect, useState } from "react";

import { request } from "./api.js";

export default function useReportPeriods(token) {
  const [periods, setPeriods] = useState([]);

  const reload = useCallback(() => {
    if (!token) {
      setPeriods([]);
      return Promise.resolve([]);
    }
    return request("/api/v1/periods/")
      .then((body) => {
        const rows = Array.isArray(body?.results) ? body.results : [];
        setPeriods(rows);
        return rows;
      })
      .catch(() => {
        setPeriods([]);
        return [];
      });
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { periods, reload };
}
