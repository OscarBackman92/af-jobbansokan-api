import { useEffect, useId, useRef, useState } from "react";

export default function RowOverflowMenu({ items = [], disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  const visibleItems = items.filter(Boolean);

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

  if (visibleItems.length === 0) return null;

  const hasDesktopItems = visibleItems.some((item) => !item.mobileOnly);

  return (
    <div
      className={`row-menu${hasDesktopItems ? "" : " row-menu--mobile-only"}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="secondary small row-menu-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label="Fler åtgärder"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">…</span>
      </button>
      {open && (
        <div className="row-menu-list" role="menu" id={menuId}>
          {visibleItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`${item.danger ? "danger" : "secondary"}${
                item.mobileOnly ? " row-menu-item--mobile" : ""
              }`}
              disabled={disabled || item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
