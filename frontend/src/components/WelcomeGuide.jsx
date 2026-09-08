export default function WelcomeGuide({ onDismiss, onNavigate }) {
  return (
    <section className="welcome-guide card" aria-labelledby="welcome-guide-heading">
      <div className="welcome-guide-head">
        <div>
          <h2 id="welcome-guide-heading">Snabbguide</h2>
          <p className="muted welcome-guide-lede">
            Översikt, sparade jobb, ansökningar, Platsbanken och CV. Rapportering
            finns under Ansökningar och på översikten.
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
              <strong>Översikt</strong> — vad som ska sökas och vad som väntar.
            </li>
            <li>
              <strong>Sparade &amp; ansökningar</strong> — det du vill söka, och det du redan sökt.
            </li>
            <li>
              <strong>Annonser &amp; CV</strong> — Platsbanken plus matchning mot ditt CV.
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
