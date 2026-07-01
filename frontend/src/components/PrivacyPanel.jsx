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
          Jobbsöket är en personlig ansökningstavla. Du äger din data och kan
          exportera den som CSV eller radera kontot när som helst.
        </p>

        <h3>Vad vi lagrar</h3>
        <ul>
          <li>Kontouppgifter: e-post, namn.</li>
          <li>Ansökningar: företag, roll, status, datum, kontakter och anteckningar.</li>
          <li>CV i strukturerad form (kompetenser, erfarenhet, utbildning).</li>
          <li>Tidslinjehändelser kopplade till varje ansökan.</li>
        </ul>

        <h3>Vad vi inte lagrar</h3>
        <ul>
          <li>Uppladdade CV-filer — de parsas i minnet och sparas aldrig.</li>
          <li>Platsbankens annonser — sökningar görs live och cachas inte permanent.</li>
        </ul>

        <h3>Hur data används</h3>
        <p>
          Data används enbart för att visa din tavla, matcha kompetenser mot
          annonser och skicka påminnelser om du har konfigurerat e-post. Vi
          säljer inte data och delar den inte med arbetsgivare.
        </p>

        <h3>Dina rättigheter</h3>
        <ul>
          <li>Exportera all data som CSV från tavlan.</li>
          <li>Radera kontot och all tillhörande data under Profil & CV.</li>
          <li>Begära information om vad som lagras via kontakt med oss.</li>
        </ul>

        <p className="muted">
          Senast uppdaterad: juni 2026. Vid frågor, kontakta oss via den
          e-postadress du registrerade kontot med.
        </p>
      </div>
    </section>
  );
}
