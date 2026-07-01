/** Explainable CV ↔ job match (Teal-style score + missing skills). */
export default function MatchScore({ match, variant = "compact" }) {
  if (!match?.total) return null;

  const percent = Math.round((match.count / match.total) * 100);
  const tone =
    percent >= 70 ? "strong" : percent >= 40 ? "medium" : percent > 0 ? "weak" : "none";

  if (variant === "compact") {
    return (
      <div className={`match-score match-score--${tone}`}>
        <div className="match-score-head">
          <span className="match-score-label">
            {match.count}/{match.total} kompetenser
          </span>
          <span className="match-score-pct">{percent}%</span>
        </div>
        <div
          className="match-score-bar"
          role="progressbar"
          aria-valuenow={match.count}
          aria-valuemin={0}
          aria-valuemax={match.total}
          aria-label={`Matchar ${match.count} av ${match.total} kompetenser`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        {match.missing?.length > 0 && (
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
          Matchar {match.count}/{match.total} kompetenser ({percent}%)
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
      {match.matched?.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">Du har</span>
          <div className="match-score-chips">
            {match.matched.map((skill) => (
              <span className="badge applied" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      {match.missing?.length > 0 && (
        <div className="match-score-group">
          <span className="match-score-group-label">Saknas i CV</span>
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
