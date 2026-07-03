import {
  SKILL_GROUP_LABELS,
  addSkillToText,
  countSuggestions,
  removeSuggestion,
} from "../skills.js";

export default function SkillSuggestions({
  suggestions,
  loading,
  onAdd,
  onAddAll,
  onDismiss,
}) {
  if (!loading && countSuggestions(suggestions) === 0) return null;

  return (
    <section className="skill-suggestions" aria-live="polite">
      <div className="skill-suggestions-head">
        <div>
          <h3>Föreslagna kompetenser</h3>
          <p className="muted">
            Hittade i dina erfarenhetsbeskrivningar — lägg till det som stämmer.
          </p>
        </div>
        {!loading && countSuggestions(suggestions) > 1 && (
          <button type="button" className="secondary small" onClick={onAddAll}>
            Lägg till alla
          </button>
        )}
      </div>

      {loading && (
        <p className="muted skill-suggestions-loading">
          <span className="spinner" /> Letar kompetenser i erfarenheterna…
        </p>
      )}

      {!loading &&
        Object.entries(SKILL_GROUP_LABELS).map(([category, label]) => {
          const items = suggestions?.[category] ?? [];
          if (!items.length) return null;
          return (
            <div className="skill-suggestions-group" key={category}>
              <span className="skill-suggestions-group-label">{label}</span>
              <div className="skill-suggestions-list">
                {items.map((item) => (
                  <span className="skill-suggestion-chip" key={`${category}-${item.label}`}>
                    <button
                      type="button"
                      className="skill-suggestion-add"
                      onClick={() => onAdd(category, item.label)}
                      title={`Lägg till ${item.label}`}
                    >
                      + {item.label}
                    </button>
                    <span className="skill-suggestion-source">{item.source}</span>
                    <button
                      type="button"
                      className="skill-suggestion-dismiss"
                      onClick={() => onDismiss(category, item.label)}
                      aria-label={`Ignorera ${item.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
    </section>
  );
}
