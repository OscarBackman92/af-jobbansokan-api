import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_WIDTH = 560;
const PANEL_MAX_HEIGHT = 420;
const VIEWPORT_MARGIN = 12;

function computePanelStyle(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    window.innerWidth - width - VIEWPORT_MARGIN
  );

  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    PANEL_MAX_HEIGHT,
    openUp ? spaceAbove - VIEWPORT_MARGIN : spaceBelow - VIEWPORT_MARGIN,
    window.innerHeight - VIEWPORT_MARGIN * 2
  );

  return {
    position: "fixed",
    left: `${left}px`,
    top: openUp
      ? `${rect.top - maxHeight - VIEWPORT_MARGIN}px`
      : `${rect.bottom + VIEWPORT_MARGIN}px`,
    width: `${width}px`,
    height: `${Math.max(180, maxHeight)}px`,
    maxHeight: `${Math.max(180, maxHeight)}px`,
    zIndex: 200,
  };
}

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
  const [panelStyle, setPanelStyle] = useState(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxId = useId();
  const selectedSet = new Set(selectedIds);
  const secondaryIds = secondaryOptions.map((option) => option.id);
  const allSelected =
    secondaryIds.length > 0 && secondaryIds.every((id) => selectedSet.has(id));
  const someSelected = secondaryIds.some((id) => selectedSet.has(id));

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPanelStyle(null);
      return undefined;
    }

    function updatePosition() {
      if (!triggerRef.current) return;
      setPanelStyle(computePanelStyle(triggerRef.current));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, primaryOptions.length, secondaryOptions.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (
        panelRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
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

  const panel = open && panelStyle && (
    <div
      className="multi-select-panel multi-select-panel--floating"
      style={panelStyle}
      ref={panelRef}
    >
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
  );

  return (
    <div className="multi-select-filter">
      <button
        ref={triggerRef}
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

      {panel && createPortal(panel, document.body)}
    </div>
  );
}
