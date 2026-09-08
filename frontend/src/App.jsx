import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { request } from "./api.js";
import { clearTokens, getAccess, setTokens, logout as revokeSession } from "./auth.js";
import AuthHero from "./components/AuthHero.jsx";
import GoogleSignIn from "./components/GoogleSignIn.jsx";
import ReportBanner from "./components/ReportBanner.jsx";
import TabIcon from "./components/TabIcon.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import VerifyEmail from "./components/VerifyEmail.jsx";
import { encodeMonthFilter } from "./dates.js";
import { readGoogleCallback } from "./googleAuth.js";
import useApplications from "./useApplications.js";
import useReportPeriods from "./useReportPeriods.js";

const DashboardPanel = lazy(() => import("./components/DashboardPanel.jsx"));
const SavedPanel = lazy(() => import("./components/SavedPanel.jsx"));
const AppliedPanel = lazy(() => import("./components/AppliedPanel.jsx"));
const ReportPanel = lazy(() => import("./components/ReportPanel.jsx"));
const PostingsPanel = lazy(() => import("./components/PostingsPanel.jsx"));
const ProfilePanel = lazy(() => import("./components/ProfilePanel.jsx"));

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
  { id: "dash", label: "Översikt", short: "Hem" },
  { id: "saved", label: "Sparade jobb", short: "Sparat" },
  { id: "applied", label: "Ansökningar", short: "Sökt" },
  { id: "report", label: "Rapportera", short: "Rapport" },
  { id: "postings", label: "Annonser", short: "Annonser" },
  { id: "profile", label: "Profil & CV", short: "Profil" },
];

const TAB_META = {
  dash: { title: "Översikt — Jobbdjungeln", heading: "Översikt" },
  saved: { title: "Sparade jobb — Jobbdjungeln", heading: "Sparade jobb" },
  applied: { title: "Ansökningar — Jobbdjungeln", heading: "Ansökningar" },
  report: { title: "Rapportera — Jobbdjungeln", heading: "Rapportera" },
  postings: { title: "Annonser — Jobbdjungeln", heading: "Annonser" },
  profile: { title: "Profil och CV — Jobbdjungeln", heading: "Profil och CV" },
};

function PanelFallback() {
  return <p className="muted">Laddar…</p>;
}

const THEMES = [
  { id: "command", label: "Command" },
  { id: "daylight", label: "Daylight" },
  { id: "signal", label: "Signal" },
];

function normalizeTab(id) {
  if (id === "board") return "applied";
  return id;
}

function migrateStoredTheme(id) {
  if (id === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "command"
      : "daylight";
  }
  return id;
}

const THEME_COLOR = {
  command: "#0c0c09",
  daylight: "#f4f4f1",
  signal: "#121614",
};

function applyResolvedTheme(id) {
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", THEME_COLOR[id] || THEME_COLOR.daylight);
  }
}

function stripAuthQueryParams() {
  const params = new URLSearchParams(window.location.search);
  let changed = false;
  for (const key of ["reset_uid", "reset_token", "verify_key"]) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState({}, "", url);
}

function readTheme() {
  const stored = migrateStoredTheme(localStorage.getItem("theme"));
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

export default function App() {
  const [tab, setTab] = useState(() => readTab());
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([readTab()]));
  const [token, setToken] = useState(() => getAccess());
  const [me, setMe] = useState(null);
  const [resetCreds, setResetCreds] = useState(() => readResetCreds());
  const [verifyKey, setVerifyKey] = useState(() => readVerifyKey());
  const [googleCode, setGoogleCode] = useState(() => readGoogleCallback());
  const [theme, setTheme] = useState(() => readTheme());
  const [showKeysHelp, setShowKeysHelp] = useState(false);
  const [keysHelpClosing, setKeysHelpClosing] = useState(false);
  const [profileFocus, setProfileFocus] = useState(null);
  const [panelFilter, setPanelFilter] = useState(null);
  const [panelMonthFilter, setPanelMonthFilter] = useState("");
  const profileLeaveGuardRef = useRef(null);
  const focusedRowRef = useRef(-1);
  const tabsRef = useRef(null);

  const {
    applications,
    reload,
    upsert,
    error: applicationsError,
    setError: setApplicationsError,
    patch,
    bulk,
  } = useApplications(token);
  const { periods, reload: reloadPeriods } = useReportPeriods(token);

  const isGuest = !token;

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);

  useEffect(() => {
    if (verifyKey) {
      document.title = "Bekräfta e-post — Jobbdjungeln";
      return;
    }
    if (resetCreds) {
      document.title = "Nytt lösenord — Jobbdjungeln";
      return;
    }
    if (googleCode) {
      document.title = "Logga in med Google — Jobbdjungeln";
      return;
    }
    if (!token) {
      document.title = "Logga in — Jobbdjungeln";
      return;
    }
    document.title = TAB_META[tab]?.title || "Jobbdjungeln";
  }, [tab, token, verifyKey, resetCreds, googleCode]);

  const savedCount =
    applications?.filter((a) => a.status === "wishlist").length ?? 0;
  const appliedCount =
    applications?.filter(
      (a) =>
        a.status !== "wishlist" &&
        !["rejected", "no_response", "withdrawn", "accepted"].includes(a.status)
    ).length ?? 0;

  const keysHelpClosingRef = useRef(false);

  const closeKeysHelp = useCallback(() => {
    if (keysHelpClosingRef.current) return;
    keysHelpClosingRef.current = true;
    setKeysHelpClosing(true);
    window.setTimeout(() => {
      setShowKeysHelp(false);
      setKeysHelpClosing(false);
      keysHelpClosingRef.current = false;
    }, 220);
  }, []);

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

  function login(tokens) {
    setTokens(tokens);
    setToken(tokens.access);
  }

  function clearSession() {
    clearTokens();
    setToken(null);
    setMe(null);
    setTab("dash");
    syncTabToUrl("dash");
  }

  async function logout() {
    await revokeSession();
    setToken(null);
    setMe(null);
    setTab("dash");
    syncTabToUrl("dash");
  }

  useEffect(() => {
    applyResolvedTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!token) return;
    if (!resetCreds && !verifyKey) return;
    stripAuthQueryParams();
    setResetCreds(null);
    setVerifyKey(null);
  }, [token, resetCreds, verifyKey]);

  useEffect(() => {
    localStorage.setItem("tab", tab);
  }, [tab]);

  useLayoutEffect(() => {
    const nav = tabsRef.current;
    if (!(nav instanceof HTMLElement)) return undefined;

    // Scroll only when the active tab is clipped — nearest edge, never
    // force it to scrollLeft 0 (which hid "Översikt" under the brand).
    function alignActive() {
      const activeTab = nav.querySelector(".tab.active");
      const indicator = nav.querySelector(".tab-indicator");
      if (!(activeTab instanceof HTMLElement)) return;
      const navRect = nav.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      let delta = 0;
      if (tabRect.left < navRect.left + 8) {
        delta = tabRect.left - navRect.left - 8;
      } else if (tabRect.right > navRect.right - 8) {
        delta = tabRect.right - navRect.right + 8;
      }
      if (Math.abs(delta) > 1) {
        nav.scrollBy({ left: delta, behavior: "auto" });
      }
      if (indicator instanceof HTMLElement) {
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
        indicator.classList.add("is-ready");
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
        closeKeysHelp();
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
  }, [closeKeysHelp]);

  useEffect(() => {
    const onPopState = () => setTab(readTab());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!token) return;
    request("/api/v1/me/")
      .then(setMe)
      .catch((err) => {
        // True expiry is handled by auth-expired. A 5xx/timeout must not
        // wipe a still-valid refresh token just because /me/ failed.
        if (err?.status === 401) clearSession();
      });
  }, [token]);

  // The api layer fires this when a refresh fails (session truly expired).
  useEffect(() => {
    const handler = () => clearSession();
    window.addEventListener("auth-expired", handler);
    return () => window.removeEventListener("auth-expired", handler);
  }, []);

  let pageHeading = "Logga in";
  if (verifyKey) pageHeading = "Bekräfta e-post";
  else if (resetCreds) pageHeading = "Nytt lösenord";
  else if (googleCode) pageHeading = "Logga in med Google";
  else if (token) pageHeading = TAB_META[tab]?.heading ?? "Jobbdjungeln";

  return (
    <div className={isGuest ? "app app--guest" : "app"}>
      <header className="header">
        <a
          className="brand brand-link"
          href={token ? "/app/?tab=dash" : "/"}
          aria-label={
            token
              ? "Jobbdjungeln – till översikten"
              : "Jobbdjungeln – till startsidan"
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
          <img
            className="logo-img"
            src="/app/favicon.svg?v=2"
            width="36"
            height="36"
            alt=""
          />
          <div className="brand-text">
            <span className="brand-name">Jobbdjungeln</span>
          </div>
        </a>
        {!token ? (
          <div className="header-actions header-actions--guest">
            <nav className="header-guest-nav" aria-label="Huvudnavigering">
              <a href="/">Start</a>
              <a href="/om/">Om</a>
              <a href="/faq/">Frågor</a>
              <a href="/integritet/">Integritet</a>
              <a
                className="btn-primary"
                href="/app/"
                aria-current={
                  !resetCreds && !verifyKey && !googleCode ? "page" : undefined
                }
              >
                Logga in
              </a>
            </nav>
          </div>
        ) : (
          <nav ref={tabsRef} className="tabs" aria-label="Huvudnavigering">
            <span className="tab-indicator" aria-hidden="true" />
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`/app/?tab=${t.id}`}
                className={`${tab === t.id ? "tab active" : "tab"}${
                  t.id === "report" ? " tab--desktop-only" : ""
                }`}
                aria-label={t.label}
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
                <TabIcon id={t.id} />
                <span className="tab-label-full">{t.label}</span>
                <span className="tab-label-short" aria-hidden="true">
                  {t.short}
                </span>
                {t.id === "saved" && applications && (
                  <span className="tab-count" aria-hidden="true">
                    {savedCount}
                  </span>
                )}
                {t.id === "applied" && applications && (
                  <span className="tab-count" aria-hidden="true">
                    {appliedCount}
                  </span>
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
              onClick={logout}
              title="Logga ut"
            >
              Logga ut
            </button>
          </div>
        )}
      </header>

      <main className={isGuest ? "main main--guest" : "main"}>
        {!isGuest && <h1 className="sr-only">{pageHeading}</h1>}
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
        {verifyKey && !token && !googleCode && (
          <VerifyEmail
            verifyKey={verifyKey}
            onDone={() => {
              window.history.replaceState({}, "", window.location.pathname);
              setVerifyKey(null);
            }}
          />
        )}
        {resetCreds && !token && !verifyKey && !googleCode && (
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
        {token && (
          <>
            {(tab === "dash" || tab === "applied" || tab === "report") && (
              <ReportBanner
                periods={periods}
                onOpenPeriod={(key) =>
                  changeTab("report", {
                    monthFilter: encodeMonthFilter("report", key),
                  })
                }
              />
            )}
            <Suspense fallback={<PanelFallback />}>
              {visitedTabs.has("dash") && (
                <div
                  className={
                    tab === "dash" ? "tab-panel" : "tab-panel tab-panel-hidden"
                  }
                  aria-hidden={tab !== "dash"}
                >
                  <DashboardPanel
                    token={token}
                    onNavigate={changeTab}
                    active={tab === "dash"}
                    periods={periods}
                  />
                </div>
              )}
              {visitedTabs.has("saved") && (
                <div
                  className={
                    tab === "saved" ? "tab-panel" : "tab-panel tab-panel-hidden"
                  }
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
              )}
              {visitedTabs.has("applied") && (
                <div
                  className={
                    tab === "applied" ? "tab-panel" : "tab-panel tab-panel-hidden"
                  }
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
              )}
              {visitedTabs.has("report") && (
                <div
                  className={
                    tab === "report" ? "tab-panel" : "tab-panel tab-panel-hidden"
                  }
                  aria-hidden={tab !== "report"}
                >
                  <ReportPanel
                    token={token}
                    periods={periods}
                    onPeriodsReload={reloadPeriods}
                    initialMonthFilter={tab === "report" ? panelMonthFilter : ""}
                  />
                </div>
              )}
              {visitedTabs.has("postings") && (
                <div
                  className={
                    tab === "postings" ? "tab-panel" : "tab-panel tab-panel-hidden"
                  }
                  aria-hidden={tab !== "postings"}
                >
                  <PostingsPanel
                    onNavigate={changeTab}
                    upsert={upsert}
                    active={tab === "postings"}
                  />
                </div>
              )}
              {visitedTabs.has("profile") && (
                <div
                  className={
                    tab === "profile" ? "tab-panel" : "tab-panel tab-panel-hidden"
                  }
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
              )}
            </Suspense>
          </>
        )}
      </main>

      {showKeysHelp && (
        <div
          className={keysHelpClosing ? "keys-help keys-help--closing" : "keys-help"}
          role="dialog"
          aria-modal="true"
          aria-label="Tangentbordsgenvägar"
          onClick={closeKeysHelp}
        >
          <div
            className="keys-help-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <h2>Tangentbord</h2>
              <button
                type="button"
                className="secondary small"
                onClick={closeKeysHelp}
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
        Din data är din — exportera eller radera när du vill.
        <nav className="footer-nav" aria-label="Sidfot">
          <a href="/">Start</a>
          <a href="/om/">Om</a>
          <a href="/faq/">Vanliga frågor</a>
          <a href="/integritet/">Integritetspolicy</a>
          {!token && <a href="/app/">Logga in</a>}
        </nav>
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
