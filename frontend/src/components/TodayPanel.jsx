import { downloadSingleActionIcs, downloadTodayActionsIcs } from "../calendar.js";
import { buildTodayActions, groupTodayActions } from "../dates.js";

const KIND_LABELS = {
  followup: "Uppföljning",
  deadline: "Ansök",
  upcoming: "Kommande",
};

function ActionRow({ item, onOpen }) {
  return (
    <li>
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
  );
}

function ActionGroup({
  title,
  summary,
  items,
  onOpen,
  calendarLabel,
  calendarFilename,
}) {
  if (!items.length) return null;
  return (
    <div className="today-group">
      <div className="today-group-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{summary}</p>
        </div>
        <button
          type="button"
          className="secondary small"
          onClick={() => downloadTodayActionsIcs(items, calendarFilename)}
        >
          {calendarLabel}
        </button>
      </div>
      <ul className="today-list">
        {items.map((item) => (
          <ActionRow
            key={`${item.application.id}-${item.kind}-${item.date}`}
            item={item}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  );
}

export default function TodayPanel({ applications, onOpen }) {
  const items = buildTodayActions(applications);
  if (!items.length) return null;

  const { followUps, applyBeforeDeadline } = groupTodayActions(items);
  const overdueFollowUps = followUps.filter(
    (item) => item.kind === "followup" && item.sortKey < 0
  ).length;
  const overdueDeadlines = applyBeforeDeadline.filter(
    (item) => item.sortKey < 0
  ).length;

  const followUpSummary = [
    `${followUps.length} ${followUps.length === 1 ? "sak" : "saker"}`,
    overdueFollowUps > 0
      ? `varav ${overdueFollowUps} väntar för länge på svar`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  const deadlineSummary = [
    `${applyBeforeDeadline.length} ${
      applyBeforeDeadline.length === 1 ? "annons" : "annonser"
    }`,
    overdueDeadlines > 0
      ? `varav ${overdueDeadlines} passerad${overdueDeadlines === 1 ? "" : "e"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="card today-panel">
      <div className="row-between today-panel-head">
        <div>
          <h2>Idag &amp; att göra</h2>
          <p className="muted">
            {overdueFollowUps > 0 &&
              `${overdueFollowUps} väntar för länge på svar · `}
            {items.length} {items.length === 1 ? "sak" : "saker"} att ta tag i
          </p>
        </div>
      </div>

      <ActionGroup
        title={`Väntar på svar (${followUps.length})`}
        summary={followUpSummary}
        items={followUps}
        onOpen={onOpen}
        calendarLabel="Lägg uppföljningar i kalender"
        calendarFilename="jobbsoket-uppfoljning.ics"
      />
      <ActionGroup
        title={`Sök innan sista dag (${applyBeforeDeadline.length})`}
        summary={deadlineSummary}
        items={applyBeforeDeadline}
        onOpen={onOpen}
        calendarLabel="Lägg deadlines i kalender"
        calendarFilename="jobbsoket-deadlines.ics"
      />
    </section>
  );
}
