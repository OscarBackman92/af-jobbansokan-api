export default function LaneRowToggle({ open, onToggle, label }) {
  return (
    <button
      type="button"
      className="lane-row-toggle"
      aria-expanded={open}
      onClick={onToggle}
      aria-label={open ? `Dölj detaljer för ${label}` : `Visa detaljer för ${label}`}
    >
      <span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
  );
}
