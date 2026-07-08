export default function WelcomeGuide({ onDismiss, onNavigate }) {
  return (
    <section className="welcome-guide card" aria-labelledby="welcome-guide-heading">
      <div className="welcome-guide-head">
        <div>
          <span className="section-kicker">Kom igång</span>
          <h2 id="welcome-guide-heading">Välkommen till Jobbsöket</h2>
          <p className="muted welcome-guide-lede">
            Här samlar du ansökningar, påminnelser och Platsbanken — utan Excel-ark
            och utan att tappa bort var du står i processen.
          </p>
        </div>
        <button
          type="button"
          className="secondary small welcome-guide-dismiss"
          onClick={onDismiss}
        >
          Stäng introduktionen
        </button>
      </div>

      <div className="welcome-guide-grid">
        <article className="welcome-guide-block">
          <h3>Så är appen uppbyggd</h3>
          <ol className="welcome-steps">
            <li>
              <strong>Tavlan</strong> — alla ansökningar i en pipeline från sparad
              annons till erbjudande. Sektionen <em>Idag &amp; att göra</em> visar
              vad som behöver din uppmärksamhet.
            </li>
            <li>
              <strong>Annonser</strong> — sök live i Platsbanken och spara intressanta
              jobb direkt på tavlan.
            </li>
            <li>
              <strong>Profil &amp; CV</strong> — ladda upp CV, bygg bevisprofiler och
              se hur väl annonser matchar dina kompetenser.
            </li>
          </ol>
        </article>
        <article className="welcome-guide-block">
          <h3>Dina tre första steg</h3>
          <ol className="welcome-steps welcome-steps--numbered">
            <li>Ladda upp CV under Profil &amp; CV.</li>
            <li>Lägg till en ansökan här eller spara en annons från Platsbanken.</li>
            <li>Sätt nästa steg och deadline — vi påminner dig när det är dags.</li>
          </ol>
          <div className="welcome-guide-actions">
            <button type="button" onClick={() => onNavigate?.("profile")}>
              Börja med CV
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onNavigate?.("postings")}
            >
              Sök annonser
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
