/** Checklist of covered requirements with CV source hints (no generated text). */

export default function TailorPanel({ match }) {
  const covered = match?.covered?.length
    ? match.covered
    : match?.matched_detail || [];
  if (!covered.length) return null;

  async function copyAll() {
    const lines = covered.map((item) => {
      const source = item.source?.label ? ` — hämta från ${item.source.label}` : "";
      return `Nämn ${item.term}${source}`;
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="tailor-panel" aria-labelledby="tailor-heading">
      <div className="row-between">
        <h3 id="tailor-heading">Anpassa ansökan</h3>
        <button type="button" className="secondary small" onClick={copyAll}>
          Kopiera checklista
        </button>
      </div>
      <p className="muted">
        Per krav du täcker — vilka erfarenhetsrader du kan hänvisa till.
      </p>
      <ul className="tailor-list">
        {covered.map((item) => (
          <li key={item.term}>
            <strong>Nämn {item.term}</strong>
            {item.source?.label ? (
              <span className="muted"> — hämta från {item.source.label}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
