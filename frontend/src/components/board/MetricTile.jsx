export default function MetricTile({
  label,
  value,
  detail,
  tone = "default",
  filterId,
  onFilter,
  motionIndex = 0,
}) {
  const className = `metric-tile metric-tile--${tone}${
    filterId ? " metric-tile--interactive" : ""
  }`;
  const content = (
    <>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </>
  );
  if (filterId && onFilter) {
    return (
      <button
        type="button"
        className={className}
        style={{ "--motion-index": motionIndex }}
        onClick={() => onFilter(filterId)}
        aria-label={`Filtrera: ${label}`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={className} style={{ "--motion-index": motionIndex }}>
      {content}
    </div>
  );
}
