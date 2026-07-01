import { downloadSingleActionIcs, downloadTodayActionsIcs } from "../calendar.js";
import { buildTodayActions } from "../dates.js";

const KIND_LABELS = {
  followup: "Uppföljning",
  deadline: "Deadline",
  upcoming: "Kommande",
};

export default function TodayPanel({ applications, onOpen }) {
  const items = buildTodayActions(applications);
  if (!items.length) return null;

  const todayCount = items.filter(
    (item) => item.kind === "followup" && item.sortKey === 0
  ).length;
  const overdueCount = items.filter(
    (item) => item.kind === "followup" && item.sortKey < 0
  ).length;

  return (
    <section className="card today-panel">
      <div className="row-between today-panel-head">
        <div>
          <h2>Idag &amp; att göra</h2>
          <p className="muted">
            {overdueCount > 0 && `${overdueCount} försenade · `}
            {todayCount > 0 && `${todayCount} idag · `}
            {items.length} {items.length === 1 ? "åtgärd" : "åtgärder"} totalt
          </p>
        </div>
        <button
          type="button"
          className="secondary small"
          onClick={() => downloadTodayActionsIcs(items)}
        >
          Lägg alla i kalender
        </button>
      </div>
      <ul className="today-list">
        {items.map((item) => (
          <li key={`${item.application.id}-${item.kind}-${item.date}`}>
            <div className="today-list-main">
              <span className={`today-kind today-kind--${item.kind}`}>
                {KIND_LABELS[item.kind]}
              </span>
              <button
                type="button"
                className="linklike"
                onClick={() => onOpen(item.application)}
              >
                {item.application.title} — {item.application.company}
              </button>
              <span className="muted today-list-reason">{item.label}</span>
            </div>
            <button
              type="button"
              className="secondary small"
              title="Ladda ner kalenderfil (.ics)"
              onClick={() => downloadSingleActionIcs(item)}
            >
              Kalender
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
