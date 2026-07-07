import { useRef } from "react";

import { CATEGORY_LABELS } from "../jobProfiles.js";

function SuggestionChips({ items, onAdd, onDismiss }) {
  if (!items?.length) return null;
  return (
    <div className="evidence-suggestions">
      {items.map((item) => (
        <span className="evidence-suggestion" key={`${item.term}-${item.category}`}>
          <button type="button" onClick={() => onAdd(item)} title={`Lägg till ${item.term}`}>
            + {item.term}
          </button>
          <button
            type="button"
            className="evidence-suggestion-dismiss"
            onClick={() => onDismiss(item.term)}
            aria-label={`Ignorera ${item.term}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export default function EvidenceRow({
  title,
  evidence,
  suggestions,
  onAddSuggestion,
  onDismissSuggestion,
  onRemoveEvidence,
}) {
  return (
    <div className="evidence-row">
      <div className="evidence-row-head">
        <span className="evidence-row-title">{title}</span>
      </div>
      {evidence.length > 0 && (
        <div className="evidence-chips">
          {evidence.map((item) => (
            <span className="evidence-chip" key={item.id}>
              <span>{item.term}</span>
              <span className="evidence-chip-category">{CATEGORY_LABELS[item.category]}</span>
              <button
                type="button"
                className="evidence-chip-remove"
                onClick={() => onRemoveEvidence(item.term)}
                aria-label={`Ta bort ${item.term}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <SuggestionChips
        items={suggestions}
        onAdd={onAddSuggestion}
        onDismiss={onDismissSuggestion}
      />
    </div>
  );
}

export function ManualEvidenceAdd({ onAdd }) {
  const termRef = useRef(null);
  const categoryRef = useRef(null);

  function add() {
    const term = termRef.current?.value.trim() ?? "";
    const category = categoryRef.current?.value ?? "domain";
    if (!term) return;
    onAdd({ term, category });
    if (termRef.current) termRef.current.value = "";
  }

  function onKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className="manual-evidence-add">
      <input
        ref={termRef}
        placeholder="Lägg till kompetens manuellt"
        aria-label="Kompetens"
        onKeyDown={onKeyDown}
      />
      <select ref={categoryRef} defaultValue="domain" aria-label="Kategori">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <button type="button" className="secondary small" onClick={add}>
        Lägg till
      </button>
    </div>
  );
}
