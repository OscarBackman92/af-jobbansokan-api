import { useState } from "react";

import { request } from "../api.js";
import { googleClientId, startGoogleLogin } from "../googleAuth.js";
import AuthIntro from "./AuthIntro.jsx";
import PasswordInput from "./PasswordInput.jsx";

export default function AuthHero({ onLogin }) {
  return (
    <div className="auth-page">
      <div className="auth-page-inner">
        <AuthIntro />
        <div className="auth-page-form">
          <AuthCard onLogin={onLogin} />
        </div>
      </div>
    </div>
  );
}

function AuthCard({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  function switchMode(next) {
    setMode(next);
    setError(null);
    setSent(false);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "forgot") {
        await request("/dj-rest-auth/password/reset/", {
          method: "POST",
          auth: false,
          body: { email },
        });
        setSent(true);
        return;
      }
      const data =
        mode === "login"
          ? await request("/dj-rest-auth/login/", {
              method: "POST",
              auth: false,
              body: { email, password },
            })
          : await request("/dj-rest-auth/registration/", {
              method: "POST",
              auth: false,
              body: { email, password1: password, password2: password },
            });
      if (mode === "register") {
        setPendingEmail(email);
        setSent(true);
        return;
      }
      onLogin({ access: data.access, refresh: data.refresh });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot" && sent) {
    return (
      <div className="card narrow auth-card">
        <h2>Kolla din mejl</h2>
        <p className="muted">
          Om det finns ett konto för <strong>{email}</strong> har vi skickat
          en återställningslänk dit. Länken är giltig en begränsad tid.
        </p>
        <button onClick={() => switchMode("login")}>Tillbaka till inloggning</button>
      </div>
    );
  }

  if (mode === "register" && sent) {
    return (
      <div className="card narrow auth-card">
        <h2>Bekräfta din e-post</h2>
        <p className="muted">
          Vi har skickat en verifieringslänk till{" "}
          <strong>{pendingEmail || email}</strong>. Klicka på länken i mejlet
          innan du loggar in.
        </p>
        <button onClick={() => switchMode("login")}>Till inloggningen</button>
      </div>
    );
  }

  const heading =
    mode === "login" ? "Logga in" : mode === "register" ? "Skapa konto" : "Glömt lösenord";

  return (
    <form className="card narrow auth-card" onSubmit={submit}>
      <h2>{heading}</h2>
      <p className="muted">
        {mode === "login" && "Logga in för att se dina ansökningar."}
        {mode === "register" &&
          "Mejl och lösenord. Vi skickar en länk så du kan verifiera adressen."}
        {mode === "forgot" &&
          "Ange din e-post så skickar vi en länk för att välja nytt lösenord."}
      </p>
      <label>
        E-postadress
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="namn@exempel.se"
          required
        />
      </label>
      {mode !== "forgot" && (
        <div className="field">
          <label htmlFor="auth-password">Lösenord</label>
          <PasswordInput
            id="auth-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>
        {busy
          ? "Vänta…"
          : mode === "login"
            ? "Logga in"
            : mode === "register"
              ? "Skapa konto"
              : "Skicka återställningslänk"}
      </button>
      {mode !== "forgot" && googleClientId() && (
        <>
          <div className="auth-divider" aria-hidden="true">
            <span>eller</span>
          </div>
          <button
            type="button"
            className="secondary google-btn"
            onClick={startGoogleLogin}
          >
            Fortsätt med Google
          </button>
        </>
      )}

      <div className="auth-links">
        {mode === "login" && (
          <>
            <button
              type="button"
              className="linklike"
              onClick={() => switchMode("forgot")}
            >
              Glömt lösenord?
            </button>
            <button
              type="button"
              className="linklike"
              onClick={() => switchMode("register")}
            >
              Ny här? Skapa ett konto
            </button>
          </>
        )}
        {mode === "register" && (
          <button
            type="button"
            className="linklike"
            onClick={() => switchMode("login")}
          >
            Har du redan ett konto? Logga in
          </button>
        )}
        {mode === "forgot" && (
          <button
            type="button"
            className="linklike"
            onClick={() => switchMode("login")}
          >
            Tillbaka till inloggning
          </button>
        )}
      </div>
    </form>
  );
}
