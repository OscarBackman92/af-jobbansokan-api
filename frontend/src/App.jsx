import { useEffect, useState } from "react";

import { request } from "./api.js";
import AuthHero from "./components/AuthHero.jsx";
import BoardPanel from "./components/BoardPanel.jsx";
import PostingsPanel from "./components/PostingsPanel.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";

const TABS = [
  { id: "board", label: "Tavlan" },
  { id: "postings", label: "Annonser" },
  { id: "profile", label: "Profil & CV" },
];

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "forest", label: "Skog" },
  { id: "dark", label: "Mörk" },
];

export default function App() {
  const [tab, setTab] = useState("board");
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [me, setMe] = useState(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "indigo"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!token) return;
    request("/api/v1/me/", { token })
      .then(setMe)
      .catch(() => logout()); // expired/invalid token
  }, [token]);

  function login(access) {
    localStorage.setItem("token", access);
    setToken(access);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setMe(null);
    setTab("board");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            A
          </div>
          <div>
            <h1>Ansökt</h1>
            <p className="tagline">Koll på varje ansökan</p>
          </div>
        </div>
        {token && (
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
        )}
      </header>

      <main className="main">
        {!token && <AuthHero onLogin={login} />}
        {token && tab === "board" && <BoardPanel token={token} />}
        {token && tab === "postings" && <PostingsPanel token={token} />}
        {token && tab === "profile" && (
          <ProfilePanel token={token} me={me} onMeChange={setMe} onLogout={logout} />
        )}
      </main>

      <footer className="footer">
        Din ansökningsdata är din: exportera den som CSV när du vill, eller
        radera kontot och allt med det.
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
