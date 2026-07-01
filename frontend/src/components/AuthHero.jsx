import { useState } from "react";

import { request } from "../api.js";
import { googleClientId, startGoogleLogin } from "../googleAuth.js";

export default function AuthHero({ onLogin }) {
  return (
    <div className="hero hero-auth">
      <div className="hero-copy">
        <span className="section-kicker">Gratis jobbsök-tracker</span>
        <h2>
          Sluta tappa bort
          <br />
          <span className="grad">dina ansökningar.</span>
        </h2>
        <p className="lede">
          Ansökt samlar pipeline, påminnelser och Platsbanken på ett ställe —
          så du vet vad som händer idag och vad du ska göra härnäst.
        </p>
        <ul className="checklist">
          <li>Panelen Idag &amp; att göra med export till Google/Outlook-kalender</li>
          <li>CV-match mot annonser — se vilka kompetenser som saknas</li>
          <li>Sök live i Platsbanken och spara annonser direkt på tavlan</li>
          <li>Kontaktuppgifter, tidslinje och CSV-export — din data, dina regler</li>
        </ul>
        <div className="hero-metrics" aria-hidden="true">
          <div className="metric-tile metric-tile--cyan">
            <span className="metric-label">Pipeline</span>
            <strong>7</strong>
            <span className="metric-detail">steg</span>
          </div>
          <div className="metric-tile metric-tile--green">
            <span className="metric-label">Data</span>
            <strong>100%</strong>
            <span className="metric-detail">din kontroll</span>
          </div>
        </div>
      </div>
      <AuthCard onLogin={onLogin} />
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
      <div className="card narrow">
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
      <div className="card narrow">
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
      <span className="section-kicker">Access terminal</span>
      <h2>{heading}</h2>
      <p className="muted">
        {mode === "login" && "Välkommen tillbaka."}
        {mode === "register" && "E-post och lösenord — vi skickar en verifieringslänk."}
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
        <label>
          Lösenord
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
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
