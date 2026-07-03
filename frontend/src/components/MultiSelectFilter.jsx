import { useEffect, useId, useRef, useState } from "react";

/**
 * Platsbanken-style two-column multi-select (browse left, checkboxes right).
 */
export default function MultiSelectFilter({
  triggerLabel,
  summary,
  primaryTitle,
  secondaryTitle,
  primaryOptions,
  secondaryOptions,
  activePrimaryId,
  onActivePrimaryChange,
  selectedIds,
  onToggleSecondary,
  onSelectAllSecondary,
  onClearSecondary,
  secondaryLoading = false,
  secondaryEmptyText = "Välj kategori till vänster",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();
  const selectedSet = new Set(selectedIds);
  const secondaryIds = secondaryOptions.map((option) => option.id);
  const allSelected =
    secondaryIds.length > 0 && secondaryIds.every((id) => selectedSet.has(id));
  const someSelected = secondaryIds.some((id) => selectedSet.has(id));

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="multi-select-filter" ref={rootRef}>
      <button
        type="button"
        className={`multi-select-trigger${open ? " multi-select-trigger--open" : ""}${
          selectedIds.length ? " multi-select-trigger--active" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{triggerLabel}</span>
        {summary && <span className="multi-select-summary">{summary}</span>}
        <span className="multi-select-chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="multi-select-panel">
          <div className="multi-select-column">
            <div className="multi-select-column-head">
              <span>{primaryTitle}</span>
            </div>
            <ul className="multi-select-primary" role="listbox">
              {primaryOptions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={
                      option.id === activePrimaryId
                        ? "multi-select-primary-item multi-select-primary-item--active"
                        : "multi-select-primary-item"
                    }
                    onClick={() => onActivePrimaryChange(option.id)}
                  >
                    <span>{option.label}</span>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="multi-select-column">
            <div className="multi-select-column-head">
              <span>{secondaryTitle}</span>
              {someSelected && (
                <button
                  type="button"
                  className="linklike multi-select-clear"
                  onClick={onClearSecondary}
                >
                  Rensa
                </button>
              )}
            </div>
            {!activePrimaryId ? (
              <p className="muted multi-select-empty">{secondaryEmptyText}</p>
            ) : secondaryLoading ? (
              <p className="muted multi-select-empty">Laddar…</p>
            ) : secondaryOptions.length === 0 ? (
              <p className="muted multi-select-empty">Inga val hittades</p>
            ) : (
              <ul className="multi-select-secondary" id={listboxId} role="listbox">
                <li>
                  <label className="multi-select-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={(event) =>
                        onSelectAllSecondary(event.target.checked, secondaryOptions)
                      }
                    />
                    <span>Välj alla</span>
                  </label>
                </li>
                {secondaryOptions.map((option) => (
                  <li key={option.id}>
                    <label className="multi-select-check">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(option.id)}
                        onChange={() => onToggleSecondary(option)}
                      />
                      <span>{option.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
