import { useState } from "react";

import ApplicantPanel from "./panels/ApplicantPanel.jsx";
import EmployerPanel from "./panels/EmployerPanel.jsx";
import PartnerPanel from "./panels/PartnerPanel.jsx";

const TABS = [
  { id: "applicant", label: "Arbetssökande" },
  { id: "employer", label: "Arbetsgivare" },
  { id: "partner", label: "A-kassa (partner)" },
];

export default function App() {
  const [tab, setTab] = useState("applicant");

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>AF Jobbansökan</h1>
          <p className="tagline">Verifierbara jobbansökningshändelser — demo</p>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === "applicant" && <ApplicantPanel />}
        {tab === "employer" && <EmployerPanel />}
        {tab === "partner" && <PartnerPanel />}
      </main>

      <footer className="footer">
        Varje skapande, radering och utlämning loggas i en append-only
        auditlogg. Personnummer lagras aldrig i klartext.
      </footer>
    </div>
  );
}
