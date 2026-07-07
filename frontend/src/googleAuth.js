// Google sign-in via the OAuth authorization-code flow, no external
// SDK: redirect to Google's consent screen and come back to the SPA
// with ?code=...&state=..., which the backend exchanges for our JWTs.

const STATE_KEY = "google_oauth_state";

export function googleClientId() {
  return window.__ANSOKT_CONFIG__?.googleClientId || "";
}

export function startGoogleLogin() {
  const state = `g_${crypto.randomUUID()}`;
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: `${window.location.origin}/app/`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  window.location.assign(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

/** The code from Google's redirect, if the state matches what we set. */
export function readGoogleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return null;
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (expected !== state) return null;
  return code;
}
