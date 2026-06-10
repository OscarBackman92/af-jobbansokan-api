import { useEffect, useState } from "react";

import ApplicantPanel from "./panels/ApplicantPanel.jsx";
import EmployerPanel from "./panels/EmployerPanel.jsx";
import PartnerPanel from "./panels/PartnerPanel.jsx";

const TABS = [
  { id: "applicant", label: "Arbetssökande" },
  { id: "employer", label: "Arbetsgivare" },
  { id: "partner", label: "A-kassa (partner)" },
];

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "forest", label: "Skog" },
  { id: "dark", label: "Mörk" },
];

export default function App() {
  const [tab, setTab] = useState("applicant");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "indigo"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            AF
          </div>
          <div>
            <h1>Jobbansökan</h1>
            <p className="tagline">Verifierbar · Transparent · Din</p>
          </div>
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
        <div className="theme-picker">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={theme === t.id ? "active" : ""}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
