import { useState } from "react";

import { request } from "../api.js";

export default function AuthHero({ onLogin }) {
  return (
    <div className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Excel-arket, fast bättre</span>
        <h2>
          Alla dina jobbansökningar.
          <br />
          <span className="grad">Ett ställe.</span>
        </h2>
        <p className="lede">
          Sluta jaga statusar i kalkylblad. Samla varje ansökan, intervju och
          kontakt på en tavla som visar exakt var du står.
        </p>
        <ul className="checklist">
          <li>Statusflöde från Ansökt till Erbjudande — som din process ser ut</li>
          <li>Tidslinje per ansökan: samtal, intervjuer, anteckningar</li>
          <li>Sök bland Platsbankens annonser och lägg dem direkt på tavlan</li>
          <li>Exportera allt som CSV — datan är din</li>
        </ul>
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

  const heading =
    mode === "login" ? "Logga in" : mode === "register" ? "Skapa konto" : "Glömt lösenord";

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{heading}</h2>
      <p className="muted">
        {mode === "login" && "Välkommen tillbaka."}
        {mode === "register" && "Bara e-post och lösenord — igång på tio sekunder."}
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
