export default function WelcomeGuide({ onDismiss, onNavigate }) {
  return (
    <section className="welcome-guide card" aria-labelledby="welcome-guide-heading">
      <div className="welcome-guide-head">
        <div>
          <span className="section-kicker">Ny här?</span>
          <h2 id="welcome-guide-heading">Snabbguide</h2>
          <p className="muted welcome-guide-lede">
            Tre flikar: tavla, Platsbanken och CV. Det räcker för de flesta.
          </p>
        </div>
        <button
          type="button"
          className="secondary small welcome-guide-dismiss"
          onClick={onDismiss}
        >
          Stäng
        </button>
      </div>

      <div className="welcome-guide-grid">
        <article className="welcome-guide-block">
          <h3>Var allt finns</h3>
          <ol className="welcome-steps">
            <li>
              <strong>Tavlan</strong> — ansökningarna. <em>Idag &amp; att göra</em> visar
              vad som väntar.
            </li>
            <li>
              <strong>Annonser</strong> — sök och spara från Platsbanken.
            </li>
            <li>
              <strong>Profil &amp; CV</strong> — CV och matchning mot annonser.
            </li>
          </ol>
        </article>
        <article className="welcome-guide-block">
          <h3>Gör så här först</h3>
          <ol className="welcome-steps welcome-steps--numbered">
            <li>Lägg in CV under Profil &amp; CV.</li>
            <li>Lägg till en ansökan, eller spara en annons.</li>
            <li>Sätt nästa steg och datum om du vill ha påminnelse.</li>
          </ol>
          <div className="welcome-guide-actions">
            <button type="button" onClick={() => onNavigate?.("profile")}>
              Till CV
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onNavigate?.("postings")}
            >
              Till Platsbanken
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
