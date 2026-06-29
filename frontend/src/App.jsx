import { useEffect, useState } from "react";

import { request } from "./api.js";
import { clearTokens, getAccess, setTokens } from "./auth.js";
import AuthHero from "./components/AuthHero.jsx";
import BoardPanel from "./components/BoardPanel.jsx";
import PostingsPanel from "./components/PostingsPanel.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import ResetPassword from "./components/ResetPassword.jsx";

function readResetCreds() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("reset_uid");
  const token = params.get("reset_token");
  return uid && token ? { uid, token } : null;
}

const TABS = [
  { id: "board", label: "Tavlan", code: "OPS" },
  { id: "postings", label: "Annonser", code: "RADAR" },
  { id: "profile", label: "Profil & CV", code: "ID" },
];

const THEMES = [
  { id: "command", label: "Command" },
  { id: "daylight", label: "Daylight" },
  { id: "signal", label: "Signal" },
];

function readTheme() {
  const stored = localStorage.getItem("theme");
  return THEMES.some((theme) => theme.id === stored) ? stored : "command";
}

export default function App() {
  const [tab, setTab] = useState("board");
  const [token, setToken] = useState(() => getAccess());
  const [me, setMe] = useState(null);
  const [resetCreds, setResetCreds] = useState(() => readResetCreds());
  const [theme, setTheme] = useState(() => readTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!token) return;
    request("/api/v1/me/")
      .then(setMe)
      .catch(() => logout()); // refresh already tried; truly signed out
  }, [token]);

  // The api layer fires this when a refresh fails (session truly expired).
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth-expired", handler);
    return () => window.removeEventListener("auth-expired", handler);
  }, []);

  function login(tokens) {
    setTokens(tokens);
    setToken(tokens.access);
  }

  function logout() {
    clearTokens();
    setToken(null);
    setMe(null);
    setTab("board");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-bar">
          <div className="brand">
            <div className="logo" aria-hidden="true">
              A
            </div>
            <div>
              <span className="brand-kicker">Job Search Command</span>
              <h1>Ansökt</h1>
              <p className="tagline">Koll på varje ansökan</p>
            </div>
          </div>
          {token && (
            <div className="header-actions">
              <span className="system-pill">
                <span className="pulse-dot" aria-hidden="true" />
                Online
              </span>
              <div className="account">
                {me?.email && <span className="account-email">{me.email}</span>}
                <button
                  className="secondary small"
                  onClick={logout}
                  title="Logga ut"
                >
                  Logga ut
                </button>
              </div>
            </div>
          )}
        </div>
        {token && (
          <nav className="tabs" aria-label="Huvudnavigering">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "tab active" : "tab"}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-code">{t.code}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="main">
        {resetCreds && (
          <ResetPassword
            uid={resetCreds.uid}
            token={resetCreds.token}
            onDone={() => {
              window.history.replaceState({}, "", window.location.pathname);
              setResetCreds(null);
            }}
          />
        )}
        {!resetCreds && !token && <AuthHero onLogin={login} />}
        {!resetCreds && token && tab === "board" && (
          <BoardPanel token={token} onNavigate={setTab} />
        )}
        {!resetCreds && token && tab === "postings" && <PostingsPanel />}
        {!resetCreds && token && tab === "profile" && (
          <ProfilePanel token={token} me={me} onMeChange={setMe} onLogout={logout} />
        )}
      </main>

      <footer className="footer">
        <span className="footer-kicker">System</span>
        Din ansökningsdata är din: exportera som CSV eller radera kontot och allt
        med det.
        <div className="theme-picker" aria-label="Visuellt tema">
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
