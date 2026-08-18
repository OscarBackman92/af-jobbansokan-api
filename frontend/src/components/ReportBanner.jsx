function mostUrgentPeriod(periods) {
  const rank = { forsenad: 0, klar: 1 };
  return [...(periods || [])]
    .filter((period) => period.status === "klar" || period.status === "forsenad")
    .sort((a, b) => {
      const byStatus = rank[a.status] - rank[b.status];
      if (byStatus) return byStatus;
      return String(a.key).localeCompare(String(b.key));
    })[0];
}

export default function ReportBanner({ periods, onOpenPeriod }) {
  const period = mostUrgentPeriod(periods);
  if (!period?.banner) return null;
  const tone = period.status === "forsenad" ? "danger" : "notice";

  return (
    <div className={`report-banner report-banner--${tone}`} role="status">
      <p>{period.banner}</p>
      <button
        type="button"
        className={tone === "danger" ? "primary small" : "secondary small"}
        onClick={() => onOpenPeriod?.(period.key)}
      >
        Visa perioden
      </button>
    </div>
  );
}
