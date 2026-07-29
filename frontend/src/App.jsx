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
  { id: "board", label: "Ansökningar" },
  { id: "postings", label: "Annonser" },
  { id: "profile", label: "Profil & CV" },
];

const THEMES = [
  { id: "system", label: "System" },
  { id: "command", label: "Command" },
  { id: "daylight", label: "Daylight" },
  { id: "signal", label: "Signal" },
];

function resolveTheme(id) {
  if (id === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "command"
      : "daylight";
  }
  return id;
}

function readTheme() {
  const stored = localStorage.getItem("theme");
  if (stored && THEMES.some((theme) => theme.id === stored)) {
    return stored;
  }
  return "daylight";
}

function readTab() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("tab");
  if (fromUrl && TABS.some((t) => t.id === fromUrl)) {
    return fromUrl;
  }
  const stored = localStorage.getItem("tab");
  return TABS.some((t) => t.id === stored) ? stored : "board";
}

function syncTabToUrl(tab) {
  const params = new URLSearchParams(window.location.search);
  const before = params.toString();
  params.set("tab", tab);
  if (tab !== "postings") params.delete("page");
  const qs = params.toString();
  if (qs === before) return;
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.pushState(null, "", url);
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

  const isLoggedOut = !token;
  const isGuest =
    isLoggedOut && !resetCreds && !verifyKey && !googleCode;

  function changeTab(next) {
    if (next !== tab && tab === "profile" && profileLeaveGuardRef.current) {
      profileLeaveGuardRef.current(() => {
        setTab(next);
        syncTabToUrl(next);
      });
      return;
    }
    setTab(next);
    syncTabToUrl(next);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme);
    localStorage.setItem("theme", theme);

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.dataset.theme = resolveTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("tab", tab);
  }, [tab]);

  useEffect(() => {
    const onPopState = () => setTab(readTab());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    syncTabToUrl("board");
  }

  return (
    <div className={isGuest ? "app app--guest" : "app"}>
      <header className="header">
        <a className="brand brand-link" href="/">
          <div className="logo" aria-hidden="true">
            J
          </div>
          <div className="brand-text">
            <h1>Jobbsöket</h1>
          </div>
        </a>
        {!token ? (
          <nav className="header-guest-nav" aria-label="Huvudnavigering">
            <a href="/integritet/">Integritet</a>
          </nav>
        ) : (
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

      <main className={isGuest ? "main main--guest" : "main"}>
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
        {!resetCreds && !verifyKey && token && (
          <>
            <div
              className={tab === "board" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "board"}
            >
              <BoardPanel token={token} onNavigate={changeTab} />
            </div>
            <div
              className={tab === "postings" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "postings"}
            >
              <PostingsPanel onNavigate={changeTab} />
            </div>
            <div
              className={tab === "profile" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "profile"}
            >
              <ProfilePanel
                token={token}
                me={me}
                onMeChange={setMe}
                onLogout={logout}
                profileLeaveGuardRef={profileLeaveGuardRef}
              />
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        <span className="footer-kicker">Jobbsöket</span>
        Din data är din — exportera eller radera kontot när du vill.{" "}
        <a className="footer-link" href="/integritet/">
          Integritetspolicy
        </a>
        <div className="theme-picker" aria-label="Visuellt tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={theme === t.id ? "active" : ""}
              aria-pressed={theme === t.id}
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
