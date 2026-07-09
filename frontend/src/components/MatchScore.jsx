/** Explainable CV ↔ job match with evidence sources. */
export default function MatchScore({ match, variant = "compact", showMissing = true }) {
  if (!match?.total) return null;

  const percent = Math.round((match.count / match.total) * 100);
  const tone =
    percent >= 70 ? "strong" : percent >= 40 ? "medium" : percent > 0 ? "weak" : "none";
  const matchedDetail = match.matched_detail ?? [];

  function sourceLabel(source) {
    if (!source?.label) return null;
    return source.label;
  }

  if (variant === "compact") {
    return (
      <div className={`match-score match-score--${tone}`}>
        <div className="match-score-head">
          <span className="match-score-label">
            {match.count} av {match.total}
          </span>
          <span className="match-score-pct">{percent}%</span>
        </div>
        <div
          className="match-score-bar"
          role="progressbar"
          aria-valuenow={match.count}
          aria-valuemin={0}
          aria-valuemax={match.total}
          aria-label={`${match.count} av ${match.total} krav i annonsen finns i CV:t`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        {matchedDetail.length > 0 && (
          <ul className="match-evidence-list muted">
            {matchedDetail.slice(0, 3).map((item) => (
              <li key={item.term}>
                {item.term}
                {sourceLabel(item.source) ? ` — ${sourceLabel(item.source)}` : ""}
              </li>
            ))}
          </ul>
        )}
        {showMissing && match.missing?.length > 0 && (
          <p className="match-score-missing muted">
            Saknas: {match.missing.slice(0, 4).join(", ")}
            {match.missing.length > 4 ? ` +${match.missing.length - 4}` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`match-score match-score--detail match-score--${tone}`}>
      <div className="match-score-head">
        <span className={`badge ${match.count > 0 ? "applied" : "neutral"}`}>
          {match.count} av {match.total} krav ({percent}%)
        </span>
      </div>
      <div
        className="match-score-bar"
        role="progressbar"
        aria-valuenow={match.count}
        aria-valuemin={0}
        aria-valuemax={match.total}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {matchedDetail.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">Finns i CV:t</span>
          <div className="match-score-chips">
            {matchedDetail.map((item) => (
              <span className="badge applied" key={item.term} title={sourceLabel(item.source) || ""}>
                {item.term}
                {sourceLabel(item.source) ? ` · ${sourceLabel(item.source)}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {match.missing?.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">Saknas i profilen</span>
          <div className="match-score-chips">
            {match.missing.map((skill) => (
              <span className="badge rejected" key={`missing-${skill}`}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
