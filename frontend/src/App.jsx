import { useEffect, useRef, useState } from "react";

import { request } from "./api.js";
import { clearTokens, getAccess, setTokens } from "./auth.js";
import AuthHero from "./components/AuthHero.jsx";
import BoardPanel from "./components/BoardPanel.jsx";
import GoogleSignIn from "./components/GoogleSignIn.jsx";
import PostingsPanel from "./components/PostingsPanel.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import VerifyEmail from "./components/VerifyEmail.jsx";
import { readGoogleCallback } from "./googleAuth.js";

function readResetCreds() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("reset_uid");
  const token = params.get("reset_token");
  return uid && token ? { uid, token } : null;
}

function readVerifyKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get("verify_key");
}

const TABS = [
  { id: "board", label: "Tavlan" },
  { id: "postings", label: "Annonser" },
  { id: "profile", label: "Profil & CV" },
];

const THEMES = [
  { id: "command", label: "Command" },
  { id: "daylight", label: "Daylight" },
  { id: "signal", label: "Signal" },
];

function readTheme() {
  const stored = localStorage.getItem("theme");
  if (stored && THEMES.some((theme) => theme.id === stored)) {
    return stored;
  }
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "command";
  }
  return "daylight";
}

function readTab() {
  const stored = localStorage.getItem("tab");
  return TABS.some((t) => t.id === stored) ? stored : "board";
}

export default function App() {
  const [tab, setTab] = useState(() => readTab());
  const [token, setToken] = useState(() => getAccess());
  const [me, setMe] = useState(null);
  const [resetCreds, setResetCreds] = useState(() => readResetCreds());
  const [verifyKey, setVerifyKey] = useState(() => readVerifyKey());
  const [googleCode, setGoogleCode] = useState(() => readGoogleCallback());
  const [theme, setTheme] = useState(() => readTheme());
  const profileLeaveGuardRef = useRef(null);

  function changeTab(next) {
    if (next !== tab && tab === "profile" && profileLeaveGuardRef.current) {
      profileLeaveGuardRef.current(() => setTab(next));
      return;
    }
    setTab(next);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Survive page reloads on the same tab; logout resets to the board.
  useEffect(() => {
    localStorage.setItem("tab", tab);
  }, [tab]);

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
        <div className="brand">
          <div className="logo" aria-hidden="true">
            J
          </div>
          <div className="brand-text">
            <h1>Jobbsöket</h1>
          </div>
        </div>
        {token && (
          <nav className="tabs" aria-label="Huvudnavigering">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "tab active" : "tab"}
                onClick={() => changeTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
        {token && (
          <div className="header-actions">
            {me?.email && <span className="account-email">{me.email}</span>}
            <button
              className="secondary small"
              onClick={logout}
              title="Logga ut"
            >
              Logga ut
            </button>
          </div>
        )}
      </header>

      <main className="main" key={tab}>
        {googleCode && !token && (
          <GoogleSignIn
            code={googleCode}
            onLogin={(tokens) => {
              window.history.replaceState({}, "", window.location.pathname);
              setGoogleCode(null);
              login(tokens);
            }}
            onDone={() => {
              window.history.replaceState({}, "", window.location.pathname);
              setGoogleCode(null);
            }}
          />
        )}
        {verifyKey && !googleCode && (
          <VerifyEmail
            verifyKey={verifyKey}
            onDone={() => {
              window.history.replaceState({}, "", window.location.pathname);
              setVerifyKey(null);
            }}
          />
        )}
        {resetCreds && !verifyKey && (
          <ResetPassword
            uid={resetCreds.uid}
            token={resetCreds.token}
            onDone={() => {
              window.history.replaceState({}, "", window.location.pathname);
              setResetCreds(null);
            }}
          />
        )}
        {!resetCreds && !verifyKey && !googleCode && !token && (
          <AuthHero onLogin={login} />
        )}
        {!resetCreds && !verifyKey && token && tab === "board" && (
          <BoardPanel token={token} onNavigate={changeTab} />
        )}
        {!resetCreds && !verifyKey && token && tab === "postings" && (
          <PostingsPanel />
        )}
        {!resetCreds && !verifyKey && token && tab === "profile" && (
          <ProfilePanel
            token={token}
            me={me}
            onMeChange={setMe}
            onLogout={logout}
            profileLeaveGuardRef={profileLeaveGuardRef}
          />
        )}
      </main>

      <footer className="footer">
        <span className="footer-kicker">Jobbsöket</span>
        Din ansökningsdata är din: exportera som CSV eller radera kontot och allt
        med det.{" "}
        <a className="footer-link" href="/integritet/">
          Integritetspolicy
        </a>
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
