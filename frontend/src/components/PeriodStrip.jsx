const MONTH_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

function shortLabel(key) {
  const match = String(key || "").match(/^\d{4}-(\d{2})$/);
  if (!match) return key || "";
  return MONTH_SHORT[Number(match[1]) - 1] || key;
}

export default function PeriodStrip({ periods = [], selectedKey = "", onSelect }) {
  if (!periods.length) return null;

  return (
    <div className="period-strip" role="list" aria-label="Rapportperioder">
      <button
        type="button"
        className={`period-cell ${selectedKey ? "" : "is-selected"}`}
        onClick={() => onSelect?.("")}
      >
        <span className="period-cell-label">Alla</span>
      </button>
      {periods.map((period) => {
        const selected = selectedKey === period.key;
        return (
          <button
            key={period.key}
            type="button"
            role="listitem"
            className={`period-cell period-cell--${period.status} ${
              selected ? "is-selected" : ""
            }`}
            title={`${period.label} · ${period.job_count} sökta · ${period.status}`}
            aria-pressed={selected}
            onClick={() => onSelect?.(period.key)}
          >
            <span className="period-cell-label">{shortLabel(period.key)}</span>
            <strong>{period.job_count}</strong>
          </button>
        );
      })}
    </div>
  );
}
