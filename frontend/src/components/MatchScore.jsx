/** Requirement-coverage CV ↔ job match (denominator = ad requirements). */

import FormalRequirements from "./FormalRequirements.jsx";

function sourceLabel(source) {
  if (!source?.label) return null;
  return source.label;
}

export function shrinkageScoreLabel(covered, total, { kind = "krav" } = {}) {
  if (total <= 0) return null;
  if (kind === "meriterande") {
    return `Nedjusterad för korta listor — ${covered} av ${total} meriterande träffade`;
  }
  return `Nedjusterad för korta kravlistor — ${covered} av ${total} krav träffade`;
}

function GapChip({ gap, onAddEvidence }) {
  return (
    <span className="gap-chip">
      {gap.term}
      {onAddEvidence && (
        <button
          type="button"
          className="linklike gap-chip-add"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAddEvidence(gap);
          }}
        >
          + har det
        </button>
      )}
    </span>
  );
}

export default function MatchScore({
  match,
  variant = "compact",
  showMissing = true,
  onAddEvidence,
}) {
  if (!match) return null;

  const confidence = match.confidence || "high";
  const lowConfidence = confidence === "low" || match.band === "unknown";
  const mustTotal = match.must_total ?? match.total ?? 0;
  const mustCovered = match.must_covered ?? match.count ?? 0;
  const meritTotal = match.merit_total ?? 0;
  const meritCovered = match.merit_covered ?? 0;
  const meritOnly = mustTotal === 0 && meritTotal > 0;
  const coverageCovered = meritOnly ? meritCovered : mustCovered;
  const coverageTotal = meritOnly ? meritTotal : mustTotal;
  const score =
    match.score != null
      ? match.score
      : coverageTotal > 0
        ? Math.round((coverageCovered / coverageTotal) * 100)
        : null;
  const tone = lowConfidence
    ? "unknown"
    : match.band === "strong" || (score != null && score >= 70)
      ? "strong"
      : match.band === "medium" || (score != null && score >= 40)
        ? "medium"
        : score != null && score > 0
          ? "weak"
          : "none";
  const scoreExplain = meritOnly
    ? shrinkageScoreLabel(meritCovered, meritTotal, { kind: "meriterande" })
    : shrinkageScoreLabel(mustCovered, mustTotal);
  const headLabel = meritOnly
    ? `${meritCovered} av ${meritTotal} meriterande`
    : `${mustCovered} av ${mustTotal} krav`;

  // No requirements extracted and no legacy total → nothing to show.
  if (!lowConfidence && !mustTotal && !meritTotal && !match.total) return null;

  const gaps = match.gaps?.length
    ? match.gaps
    : (match.missing || []).map((term) => ({ term, level: "must" }));
  const mustGaps = gaps.filter((g) => g.level !== "merit").slice(0, 3);
  const covered = match.covered?.length
    ? match.covered
    : match.matched_detail || [];

  if (variant === "compact") {
    if (lowConfidence) return null;
    return (
      <div className={`match-score match-score--${tone}`}>
        <div className="match-score-head">
          <span className="match-score-label">{headLabel}</span>
          {score != null && (
            <span
              className="match-score-pct"
              title={scoreExplain || undefined}
              aria-label={scoreExplain || undefined}
            >
              {score}%
            </span>
          )}
        </div>
        {!lowConfidence && coverageTotal > 0 && (
          <div
            className="match-score-bar"
            role="progressbar"
            aria-valuenow={coverageCovered}
            aria-valuemin={0}
            aria-valuemax={coverageTotal}
            aria-label={
              meritOnly
                ? `Du täcker ${meritCovered} av ${meritTotal} meriterande i annonsen`
                : `Du täcker ${mustCovered} av ${mustTotal} krav i annonsen`
            }
          >
            <span style={{ width: `${score ?? 0}%` }} />
          </div>
        )}
        {!lowConfidence && !meritOnly && meritTotal > 0 && (
          <p className="match-score-merit muted">
            {meritCovered} av {meritTotal} meriterande
          </p>
        )}
        {covered.length > 0 && (
          <ul className="match-evidence-list muted">
            {covered.slice(0, 3).map((item) => (
              <li key={item.term} title={sourceLabel(item.source) || ""}>
                {item.term}
                {sourceLabel(item.source) ? ` — ${sourceLabel(item.source)}` : ""}
              </li>
            ))}
          </ul>
        )}
        {showMissing && !lowConfidence && mustGaps.length > 0 && (
          <div className="match-score-gaps">
            {mustGaps.map((gap) => (
              <GapChip
                key={gap.term}
                gap={gap}
                onAddEvidence={onAddEvidence}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`match-score match-score--detail match-score--${tone}`}>
      <div className="match-score-head">
        {lowConfidence ? (
          <span className="badge neutral">Litet underlag</span>
        ) : (
          <span
            className={`badge ${coverageCovered > 0 ? "applied" : "neutral"}`}
            title={score != null ? scoreExplain || undefined : undefined}
          >
            {meritOnly
              ? `Du täcker ${meritCovered} av ${meritTotal} meriterande`
              : `Du täcker ${mustCovered} av ${mustTotal} krav`}
            {score != null ? ` (${score}%)` : ""}
          </span>
        )}
      </div>
      {!lowConfidence && !meritOnly && meritTotal > 0 && (
        <p className="muted">
          {meritCovered} av {meritTotal} meriterande
        </p>
      )}
      {!lowConfidence && coverageTotal > 0 && (
        <div
          className="match-score-bar"
          role="progressbar"
          aria-valuenow={coverageCovered}
          aria-valuemin={0}
          aria-valuemax={coverageTotal}
        >
          <span style={{ width: `${score ?? 0}%` }} />
        </div>
      )}
      {covered.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">Täcks av CV:t</span>
          <div className="match-score-chips">
            {covered.map((item) => (
              <span
                className="badge applied"
                key={item.term}
                title={sourceLabel(item.source) || ""}
              >
                {item.term}
                {sourceLabel(item.source)
                  ? ` · ${sourceLabel(item.source)}`
                  : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {mustGaps.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">Saknade krav</span>
          <div className="match-score-chips">
            {mustGaps.map((gap) => (
              <GapChip
                key={gap.term}
                gap={gap}
                onAddEvidence={onAddEvidence}
              />
            ))}
          </div>
        </div>
      )}
      {match.unused_cv_terms?.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">
            Dina termer som annonsen inte nämner
          </span>
          <div className="match-score-chips">
            {match.unused_cv_terms.map((term) => (
              <span className="badge neutral" key={`unused-${term}`}>
                {term}
              </span>
            ))}
          </div>
        </div>
      )}
      {match.formal?.length > 0 && (
        <FormalRequirements items={match.formal} />
      )}
      {!lowConfidence &&
        match.cv_terms_total > 0 &&
        match.cv_terms_used != null && (
          <p className="muted match-score-cv-used">
            {match.cv_terms_used} av dina {match.cv_terms_total} termer används
            här
          </p>
        )}
    </div>
  );
}

export { FormalRequirements };
