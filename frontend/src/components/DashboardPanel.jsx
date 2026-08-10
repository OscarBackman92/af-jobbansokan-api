import { useEffect, useState } from "react";

import { request } from "../api.js";
import MetricTile from "./board/MetricTile.jsx";

/**
 * Placeholder until the dashboard endpoint and full panel land.
 * Keeps the Översikt tab mountable without fake metrics.
 */
export default function DashboardPanel({ token, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    request("/api/v1/dashboard/")
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) {
          // Endpoint may not exist yet during the rollout.
          setError(err.message);
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const kpis = data?.kpis;

  return (
    <div className="stack">
      <section className="command-hero">
        <div className="command-hero-copy">
          <span className="section-kicker">Översikt</span>
          <h2>
            {kpis
              ? `${kpis.to_apply || 0} jobb ska sökas. ${kpis.follow_up || 0} väntar på svar.`
              : "Din översikt"}
          </h2>
          <p className="muted">
            En läsvy som länkar vidare till sparade jobb och ansökningar.
          </p>
        </div>
        {kpis && (
          <div className="metric-grid" aria-label="Nyckeltal">
            <MetricTile
              label="Att söka"
              value={kpis.to_apply}
              detail="den här veckan"
              tone={kpis.urgent > 0 ? "amber" : "default"}
              filterId="urgent"
              onFilter={() => onNavigate?.("saved", { filter: "urgent" })}
            />
            <MetricTile
              label="Följ upp"
              value={kpis.follow_up}
              detail="väntar för länge"
              tone={kpis.follow_up > 0 ? "amber" : "default"}
              filterId="late"
              onFilter={() => onNavigate?.("applied", { filter: "late" })}
            />
            <MetricTile
              label="Sparade totalt"
              value={kpis.saved_total}
              detail="wishlist"
              filterId="saved"
              onFilter={() => onNavigate?.("saved")}
            />
            <MetricTile
              label="Pågående"
              value={kpis.active_applications}
              detail="ansökningar"
              filterId="fresh"
              onFilter={() => onNavigate?.("applied")}
            />
          </div>
        )}
      </section>
      {error && (
        <section className="card">
          <p className="muted">
            Dashboard-data laddas snart.{" "}
            <span className="tag">beräknas</span>
          </p>
        </section>
      )}
      {!error && !data && (
        <section className="card">
          <div className="loading-row">
            <span className="spinner" /> Laddar översikt…
          </div>
        </section>
      )}
    </div>
  );
}
