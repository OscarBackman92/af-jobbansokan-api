const CONTACT_EMAIL = window.__ANSOKT_CONFIG__?.contactEmail || "";

export default function PrivacyPanel({ onClose }) {
  return (
    <section className="card privacy-panel">
      <div className="row-between">
        <div>
          <span className="section-kicker">Data & integritet</span>
          <h2>Integritetspolicy</h2>
        </div>
        <button type="button" className="secondary small" onClick={onClose}>
          Stäng
        </button>
      </div>

      <div className="privacy-body">
        <p>
          Jobbsöket är en personlig ansökningstavla. Du äger din data: allt
          kan exporteras som CSV och kontot kan raderas när som helst, med
          all data.
        </p>

        <h3>Personuppgiftsansvarig</h3>
        <p>
          Jobbsöket drivs som en privat tjänst och den som driver tjänsten
          är personuppgiftsansvarig.{" "}
          {CONTACT_EMAIL ? (
            <>
              Kontakta oss om dina personuppgifter på{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          ) : (
            "Kontaktuppgifter för integritetsfrågor publiceras här."
          )}
        </p>

        <h3>Vad vi lagrar och varför</h3>
        <ul>
          <li>
            Kontouppgifter (e-post, namn) och dina ansökningar, kontakter,
            anteckningar och CV i strukturerad form — för att tillhandahålla
            tjänsten. Rättslig grund: avtalet med dig (art. 6.1 b GDPR).
          </li>
          <li>
            Tekniska loggar och felrapporter utan personligt innehåll — för
            drift och säkerhet, t.ex. skydd mot intrångsförsök. Rättslig
            grund: berättigat intresse (art. 6.1 f).
          </li>
          <li>
            Påminnelsemejl skickas bara om du själv satt datum för nästa
            steg på en ansökan.
          </li>
        </ul>

        <h3>Vad vi inte lagrar</h3>
        <ul>
          <li>Uppladdade CV-filer — de tolkas i minnet och sparas aldrig.</li>
          <li>Platsbankens annonser — sökningar görs live och cachas bara kortvarigt.</li>
          <li>Inga spårningskakor och ingen analys av ditt beteende. Webbläsarens
            lagring används enbart för inloggning och dina egna inställningar.</li>
        </ul>

        <h3>Vilka som behandlar data för vår räkning</h3>
        <ul>
          <li>
            <strong>Render</strong> — serverdrift och databas i Frankfurt
            (EU). Datan lagras inom EU.
          </li>
          <li>
            <strong>Brevo</strong> — skickar verifierings-, återställnings-
            och påminnelsemejl (EU-bolag).
          </li>
          <li>
            <strong>Sentry</strong> — teknisk felrapportering, konfigurerad
            att inte skicka personuppgifter.
          </li>
          <li>
            <strong>Google</strong> — endast om du väljer att logga in med
            Google; då delar Google din e-postadress och ditt namn med oss.
          </li>
        </ul>
        <p>
          Vi säljer aldrig data och delar den inte med arbetsgivare eller
          annonsörer.
        </p>

        <h3>Hur länge data sparas</h3>
        <ul>
          <li>Ditt konto och din data finns kvar tills du raderar kontot.</li>
          <li>
            Konton som varit inaktiva i 24 månader raderas, med ett
            varningsmejl 30 dagar innan så att du hinner logga in och
            behålla kontot.
          </li>
          <li>Raderar du kontot försvinner all data direkt och permanent.</li>
        </ul>

        <h3>Dina rättigheter</h3>
        <ul>
          <li>Se all din data i appen och exportera den som CSV (tillgång och portabilitet).</li>
          <li>Rätta uppgifter direkt i appen (rättelse).</li>
          <li>Radera kontot och all data under Profil & CV (radering).</li>
          <li>Invända mot eller begära begränsning av behandling via kontaktadressen ovan.</li>
          <li>
            Klaga hos Integritetsskyddsmyndigheten (IMY) om du anser att vi
            behandlar dina uppgifter fel: <a href="https://www.imy.se" target="_blank" rel="noreferrer">imy.se</a>.
          </li>
        </ul>

        <p className="muted">
          Senast uppdaterad: juli 2026. Ändras policyn väsentligt informerar
          vi via e-post.
        </p>
      </div>
    </section>
  );
}
