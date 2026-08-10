import { useEffect, useState } from "react";

import { request } from "../api.js";

function rateLabel(entry) {
  if (entry?.insufficient_data || entry?.rate == null) return "för lite data";
  return `${Math.round(entry.rate * 100)} % svar`;
}

export default function SkillGapPanel({ token, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyTerm, setBusyTerm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    request("/api/v1/insights/skills/")
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Kunde inte hämta kompetenskoll.");
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function addTerm(term) {
    setBusyTerm(term);
    try {
      await request("/api/v1/me/resume/evidence/", {
        method: "POST",
        body: {
          term,
          category: "domain",
          source: { type: "manual", label: "Från gap-analys" },
        },
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              gap_terms: (prev.gap_terms || []).filter((row) => row.term !== term),
            }
          : prev
      );
    } catch {
      /* keep term visible */
    } finally {
      setBusyTerm(null);
    }
  }

  if (error) {
    return (
      <section className="card">
        <h2>Kompetenskoll</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="card">
        <h2>Kompetenskoll</h2>
        <div className="loading-row">
          <span className="spinner" /> Laddar…
        </div>
      </section>
    );
  }

  const gaps = data.gap_terms || [];
  const bands = data.response_by_band || [];
  const scope = data.scope || {};
  const withSnapshot = scope.with_snapshot ?? scope.applications ?? 0;
  const totalApps = scope.applications ?? 0;

  return (
    <section className="card skill-gap-panel">
      <h2>Kompetenskoll</h2>
      <p className="muted">
        {withSnapshot === 0
          ? scope.hint ||
            "Inga matchningssnapshots sparade ännu. Spara eller markera jobb som sökta."
          : `${withSnapshot} av ${totalApps} ansökningar har matchningsdata${
              scope.since ? ` sedan ${scope.since}` : ""
            }.`}
      </p>

      <div className="skill-gap-grid">
        <div>
          <h3>Svar per matchning</h3>
          <ul className="skill-gap-bands">
            {bands.map((band) => (
              <li key={band.band}>
                <span>{band.band} %</span>
                <strong>{rateLabel(band)}</strong>
                <span className="muted">
                  {band.tracked} spårade · {band.responded} svar
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Krav du oftast saknar</h3>
          {gaps.length === 0 ? (
            <p className="muted">Inga gap ännu — spara fler annonser.</p>
          ) : (
            <ul className="skill-gap-terms">
              {gaps.slice(0, 8).map((row) => (
                <li key={row.term}>
                  <button
                    type="button"
                    className="linklike"
                    onClick={() =>
                      onNavigate?.("postings", { q: row.term })
                    }
                  >
                    {row.term}
                  </button>
                  <span className="muted">
                    efterfrågas i {row.count} av {scope.applications || "?"}
                  </span>
                  <button
                    type="button"
                    className="secondary small"
                    disabled={busyTerm === row.term}
                    onClick={() => addTerm(row.term)}
                  >
                    + lägg till i profil
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
