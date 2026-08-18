import { useEffect, useRef, useState } from "react";

import { request } from "./api.js";
import { clearTokens, getAccess, setTokens } from "./auth.js";
import AuthHero from "./components/AuthHero.jsx";
import AppliedPanel from "./components/AppliedPanel.jsx";
import DashboardPanel from "./components/DashboardPanel.jsx";
import GoogleSignIn from "./components/GoogleSignIn.jsx";
import PostingsPanel from "./components/PostingsPanel.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import ReportBanner from "./components/ReportBanner.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import SavedPanel from "./components/SavedPanel.jsx";
import VerifyEmail from "./components/VerifyEmail.jsx";
import { encodeMonthFilter } from "./dates.js";
import { readGoogleCallback } from "./googleAuth.js";
import useApplications from "./useApplications.js";
import useReportPeriods from "./useReportPeriods.js";

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
  { id: "dash", label: "Översikt" },
  { id: "saved", label: "Sparade jobb" },
  { id: "applied", label: "Ansökningar" },
  { id: "postings", label: "Annonser" },
  { id: "profile", label: "Profil & CV" },
];

const THEMES = [
  { id: "system", label: "System" },
  { id: "command", label: "Command" },
  { id: "daylight", label: "Daylight" },
  { id: "signal", label: "Signal" },
];

function normalizeTab(id) {
  if (id === "board") return "applied";
  return id;
}

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
  if (fromUrl) {
    const mapped = normalizeTab(fromUrl);
    if (TABS.some((t) => t.id === mapped)) return mapped;
  }
  const stored = normalizeTab(localStorage.getItem("tab"));
  return TABS.some((t) => t.id === stored) ? stored : "dash";
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

function readDensity() {
  const stored = localStorage.getItem("density");
  return stored === "compact" ? "compact" : "comfortable";
}

export default function App() {
  const [tab, setTab] = useState(() => readTab());
  const [token, setToken] = useState(() => getAccess());
  const [me, setMe] = useState(null);
  const [resetCreds, setResetCreds] = useState(() => readResetCreds());
  const [verifyKey, setVerifyKey] = useState(() => readVerifyKey());
  const [googleCode, setGoogleCode] = useState(() => readGoogleCallback());
  const [theme, setTheme] = useState(() => readTheme());
  const [density, setDensity] = useState(() => readDensity());
  const [showKeysHelp, setShowKeysHelp] = useState(false);
  const [profileFocus, setProfileFocus] = useState(null);
  const [panelFilter, setPanelFilter] = useState(null);
  const [panelMonthFilter, setPanelMonthFilter] = useState("");
  const profileLeaveGuardRef = useRef(null);
  const focusedRowRef = useRef(-1);

  const {
    applications,
    reload,
    upsert,
    error: applicationsError,
    setError: setApplicationsError,
    patch,
    bulk,
  } = useApplications(token);
  const { periods } = useReportPeriods(token);

  const isLoggedOut = !token;
  const isGuest =
    isLoggedOut && !resetCreds && !verifyKey && !googleCode;

  const savedCount =
    applications?.filter((a) => a.status === "wishlist").length ?? 0;
  const appliedCount =
    applications?.filter(
      (a) =>
        a.status !== "wishlist" &&
        !["rejected", "no_response", "withdrawn", "accepted"].includes(a.status)
    ).length ?? 0;

  function changeTab(next, options = {}) {
    const focus = options?.focus ?? null;
    const filter = options?.filter ?? null;
    const monthFilter = options?.monthFilter ?? "";
    if (typeof options?.q === "string" && options.q.trim()) {
      try {
        sessionStorage.setItem(
          "jobbdjungeln-pending-job-q",
          options.q.trim()
        );
      } catch {
        /* ignore */
      }
    }
    const apply = () => {
      setTab(next);
      syncTabToUrl(next);
      setProfileFocus(next === "profile" ? focus : null);
      setPanelFilter(filter);
      setPanelMonthFilter(monthFilter);
    };
    if (next !== tab && tab === "profile" && profileLeaveGuardRef.current) {
      profileLeaveGuardRef.current(apply);
      return;
    }
    apply();
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
    document.documentElement.dataset.density = density;
    localStorage.setItem("density", density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem("tab", tab);
  }, [tab]);

  useEffect(() => {
    const nav = document.querySelector(".tabs");
    if (!(nav instanceof HTMLElement)) return undefined;

    // Scroll only when the active tab is clipped — nearest edge, never
    // force it to scrollLeft 0 (which hid "Översikt" under the brand).
    function alignActive() {
      const activeTab = nav.querySelector(".tab.active");
      if (!(activeTab instanceof HTMLElement)) return;
      const navRect = nav.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      let delta = 0;
      if (tabRect.left < navRect.left) {
        delta = tabRect.left - navRect.left;
      } else if (tabRect.right > navRect.right) {
        delta = tabRect.right - navRect.right;
      }
      if (Math.abs(delta) > 1) {
        nav.scrollBy({ left: delta, behavior: "auto" });
      }
    }

    alignActive();
    const observer = new ResizeObserver(() => alignActive());
    observer.observe(nav);
    for (const child of nav.querySelectorAll(".tab")) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [tab, savedCount, appliedCount, token]);

  useEffect(() => {
    function visibleRows() {
      const panel = document.querySelector("main .stack:not(.tab-panel-hidden)");
      const root =
        document.querySelector("main > div:not(.tab-panel-hidden)") || panel;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll(".lane-row:not(.lane-row--dim)")
      );
    }

    function setFocusedRow(index) {
      const rows = visibleRows();
      rows.forEach((row) => row.classList.remove("lane-row--focus"));
      if (!rows.length) {
        focusedRowRef.current = -1;
        return;
      }
      const next = ((index % rows.length) + rows.length) % rows.length;
      focusedRowRef.current = next;
      const row = rows[next];
      row.classList.add("lane-row--focus");
      row.scrollIntoView({ block: "nearest" });
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox instanceof HTMLInputElement) checkbox.focus({ preventScroll: true });
    }

    function onKeyDown(event) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing && event.key !== "Escape") return;

      if (event.key === "?" && !typing) {
        event.preventDefault();
        setShowKeysHelp((v) => !v);
        return;
      }
      if (event.key === "Escape") {
        setShowKeysHelp(false);
        window.dispatchEvent(new CustomEvent("jobbdjungeln-deselect"));
        focusedRowRef.current = -1;
        document
          .querySelectorAll(".lane-row--focus")
          .forEach((row) => row.classList.remove("lane-row--focus"));
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        const search = document.querySelector(
          'input[aria-label="Sök sparade jobb"], input[aria-label="Sök ansökningar"], input.job-search-q'
        );
        if (search instanceof HTMLInputElement) {
          search.focus();
          search.select();
        }
        return;
      }
      if (typing) return;
      if (event.key === "j") {
        event.preventDefault();
        setFocusedRow(focusedRowRef.current + 1);
        return;
      }
      if (event.key === "k") {
        event.preventDefault();
        setFocusedRow(
          focusedRowRef.current <= 0 ? 0 : focusedRowRef.current - 1
        );
        return;
      }
      if (event.key === "a" || event.key === "p") {
        const rows = visibleRows();
        const row = rows[focusedRowRef.current];
        if (!row) return;
        event.preventDefault();
        const selector =
          event.key === "a"
            ? '[data-shortcut="apply"]'
            : '[data-shortcut="plan"]';
        const btn = row.querySelector(selector);
        if (btn instanceof HTMLButtonElement && !btn.disabled) btn.click();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    setTab("dash");
    syncTabToUrl("dash");
  }

  return (
    <div className={isGuest ? "app app--guest" : "app"}>
      <header className="header">
        <a
          className="brand brand-link"
          href={token ? "/app/?tab=dash" : "/"}
          aria-label={
            token ? "Jobbdjungeln – till översikten" : undefined
          }
          onClick={(event) => {
            if (!token) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }
            event.preventDefault();
            changeTab("dash");
          }}
        >
          <div className="logo" aria-hidden="true">
            J
          </div>
          <div className="brand-text">
            <h1>Jobbdjungeln</h1>
          </div>
        </a>
        {!token ? (
          <nav className="header-guest-nav" aria-label="Huvudnavigering">
            <a href="/integritet/">Integritet</a>
          </nav>
        ) : (
          <nav className="tabs" aria-label="Huvudnavigering">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`/app/?tab=${t.id}`}
                className={tab === t.id ? "tab active" : "tab"}
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  changeTab(t.id);
                }}
                aria-current={tab === t.id ? "page" : undefined}
              >
                {t.label}
                {t.id === "saved" && applications && (
                  <span className="tab-count">{savedCount}</span>
                )}
                {t.id === "applied" && applications && (
                  <span className="tab-count">{appliedCount}</span>
                )}
              </a>
            ))}
          </nav>
        )}
        {token && (
          <div className="header-actions">
            {me?.email && <span className="account-email">{me.email}</span>}
            <button
              type="button"
              className="secondary small"
              onClick={() =>
                setDensity((d) =>
                  d === "compact" ? "comfortable" : "compact"
                )
              }
              title="Växla densitet"
              aria-pressed={density === "compact"}
            >
              {density === "compact" ? "Kompakt" : "Bekväm"}
            </button>
            <button
              type="button"
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
            {(tab === "dash" || tab === "applied") && (
              <ReportBanner
                periods={periods}
                onOpenPeriod={(key) =>
                  changeTab("applied", {
                    monthFilter: encodeMonthFilter("applied", key),
                  })
                }
              />
            )}
            <div
              className={tab === "dash" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "dash"}
            >
              <DashboardPanel
                token={token}
                onNavigate={changeTab}
                active={tab === "dash"}
                periods={periods}
              />
            </div>
            <div
              className={tab === "saved" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "saved"}
            >
              <SavedPanel
                token={token}
                applications={applications}
                reload={reload}
                upsert={upsert}
                error={applicationsError}
                setError={setApplicationsError}
                patch={patch}
                bulk={bulk}
                onNavigate={changeTab}
                initialFilter={tab === "saved" ? panelFilter : null}
              />
            </div>
            <div
              className={tab === "applied" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "applied"}
            >
              <AppliedPanel
                token={token}
                applications={applications}
                reload={reload}
                upsert={upsert}
                error={applicationsError}
                setError={setApplicationsError}
                patch={patch}
                bulk={bulk}
                onNavigate={changeTab}
                initialFilter={tab === "applied" ? panelFilter : null}
                initialMonthFilter={
                  tab === "applied" ? panelMonthFilter : ""
                }
                periods={periods}
              />
            </div>
            <div
              className={tab === "postings" ? undefined : "tab-panel-hidden"}
              aria-hidden={tab !== "postings"}
            >
              <PostingsPanel
                onNavigate={changeTab}
                upsert={upsert}
                active={tab === "postings"}
              />
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
                profileFocus={profileFocus}
                onProfileFocusHandled={() => setProfileFocus(null)}
                active={tab === "profile"}
              />
            </div>
          </>
        )}
      </main>

      {showKeysHelp && (
        <div
          className="keys-help"
          role="dialog"
          aria-modal="true"
          aria-label="Tangentbordsgenvägar"
        >
          <div className="keys-help-card">
            <div className="row-between">
              <h2>Tangentbord</h2>
              <button
                type="button"
                className="secondary small"
                onClick={() => setShowKeysHelp(false)}
              >
                Stäng
              </button>
            </div>
            <ul className="keys-help-list">
              <li>
                <kbd>/</kbd> Fokusera sök
              </li>
              <li>
                <kbd>j</kbd> / <kbd>k</kbd> Nästa / föregående rad
              </li>
              <li>
                <kbd>a</kbd> Ansök
              </li>
              <li>
                <kbd>p</kbd> Planera
              </li>
              <li>
                <kbd>esc</kbd> Avmarkera
              </li>
              <li>
                <kbd>?</kbd> Visa/dölj den här hjälpen
              </li>
            </ul>
          </div>
        </div>
      )}

      <footer className="footer">
        <span className="footer-kicker">Jobbdjungeln</span>
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
