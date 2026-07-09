export default function WelcomeGuide({ onDismiss, onNavigate }) {
  return (
    <section className="welcome-guide card" aria-labelledby="welcome-guide-heading">
      <div className="welcome-guide-head">
        <div>
          <span className="section-kicker">Första gången här?</span>
          <h2 id="welcome-guide-heading">Så här är appen tänkt</h2>
          <p className="muted welcome-guide-lede">
            Tavla, Platsbanken och CV — samlat så du slipper jaga i mail och
            kalkylark.
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
          <h3>Tre flikar</h3>
          <ol className="welcome-steps">
            <li>
              <strong>Tavlan</strong> — dina ansökningar från “sparad” till “svar”.
              Kolla <em>Idag &amp; att göra</em> när du vill se vad som är dags.
            </li>
            <li>
              <strong>Annonser</strong> — sök Platsbanken och spara det som känns
              värt att söka.
            </li>
            <li>
              <strong>Profil &amp; CV</strong> — CV och vilka kompetenser som ska
              räknas när vi matchar annonser.
            </li>
          </ol>
        </article>
        <article className="welcome-guide-block">
          <h3>Börja så här</h3>
          <ol className="welcome-steps welcome-steps--numbered">
            <li>Lägg in CV under Profil &amp; CV.</li>
            <li>Lägg till en ansökan här, eller spara en annons från Platsbanken.</li>
            <li>Sätt nästa steg och datum — då kan vi påminna dig.</li>
          </ol>
          <div className="welcome-guide-actions">
            <button type="button" onClick={() => onNavigate?.("profile")}>
              Gå till CV
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onNavigate?.("postings")}
            >
              Sök jobb
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
