import { formatMonthLabel, parseMonthFilter } from "../../dates.js";

const FUNNEL_STATUSES = [
  "screening",
  "interview",
  "forwarded",
  "offer",
  "accepted",
];

const MONTH_NAMES = [
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

export default function MonthlyStats({
  applications,
  activeMonthFilter,
  onSelectAppliedMonth,
}) {
  if (applications.length === 0) return null;

  // Applications per month, last six months (rows with applied_at only).
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_NAMES[d.getMonth()],
      count: 0,
    });
  }
  for (const a of applications) {
    if (!a.applied_at) continue;
    const month = months.find((m) => a.applied_at.startsWith(m.key));
    if (month) month.count += 1;
  }
  const max = Math.max(1, ...months.map((m) => m.count));
  const datedSum = months.reduce((sum, m) => sum + m.count, 0);
  const parsedActive = parseMonthFilter(activeMonthFilter);
  const activeAppliedKey =
    parsedActive?.field === "applied" ? parsedActive.monthKey : "";

  const inProcess = applications.filter(
    (a) => a.reached_interview || FUNNEL_STATUSES.includes(a.status)
  ).length;

  return (
    <section className="card">
      <h2>Statistik</h2>
      <p className="muted">
        Ansökningar per månad (sökt datum) · {datedSum} med datum senaste 6 mån
        av {applications.length} totalt · {inProcess} har lett till samtal,
        intervju eller längre. Klicka en månad för att filtrera listan.
      </p>
      <div
        className="chart"
        role="group"
        aria-label={`Ansökningar per månad: ${months
          .map((m) => `${m.label} ${m.count}`)
          .join(", ")}`}
      >
        {months.map((m, i) => {
          const isCurrent = i === months.length - 1;
          const isActive = activeAppliedKey === m.key;
          const className = [
            "chart-col",
            isCurrent ? "chart-col--current" : "",
            isActive ? "chart-col--active" : "",
            onSelectAppliedMonth ? "chart-col--clickable" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              type="button"
              className={className}
              key={m.key}
              title={`${m.count} st · filtrera på ${formatMonthLabel(m.key)}`}
              aria-pressed={isActive}
              aria-label={`Filtrera på ansökningar i ${formatMonthLabel(m.key)} (${m.count} st)`}
              onClick={() => onSelectAppliedMonth?.(m.key)}
            >
              <span className="chart-count">{m.count}</span>
              <div
                className={
                  m.count === 0 ? "chart-bar chart-bar--empty" : "chart-bar"
                }
                style={{
                  height: `${m.count === 0 ? 8 : (m.count / max) * 96 + 8}px`,
                }}
              />
              <span className="chart-label">{m.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
