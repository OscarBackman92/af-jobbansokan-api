/** Checklist of hard formal requirements (outside the %-score). */

export default function FormalRequirements({ items }) {
  if (!items?.length) return null;
  return (
    <div className="match-score-group formal-requirements">
      <span className="match-score-group-label">Formella krav</span>
      <ul className="formal-requirements-list">
        {items.map((item) => {
          const tone =
            item.ok === true ? "ok" : item.ok === false ? "block" : "unknown";
          return (
            <li
              key={item.key || item.label}
              className={`formal-req formal-req--${tone}`}
            >
              <span className="formal-req-mark" aria-hidden="true">
                {item.ok === true ? "✓" : item.ok === false ? "✗" : "–"}
              </span>
              <span>
                {item.label}
                {item.detail ? ` — ${item.detail}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
