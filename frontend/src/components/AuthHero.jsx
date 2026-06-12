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
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data =
        mode === "login"
          ? await request("/dj-rest-auth/login/", {
              method: "POST",
              body: { username, password },
            })
          : await request("/dj-rest-auth/registration/", {
              method: "POST",
              body: { username, password1: password, password2: password },
            });
      onLogin(data.access);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{mode === "login" ? "Logga in" : "Skapa konto"}</h2>
      <p className="muted">
        {mode === "login"
          ? "Välkommen tillbaka."
          : "Bara användarnamn och lösenord — igång på tio sekunder."}
      </p>
      <label>
        Användarnamn
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
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
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>
        {busy ? "Vänta…" : mode === "login" ? "Logga in" : "Skapa konto"}
      </button>
      <button
        type="button"
        className="linklike"
        style={{ marginTop: "0.8rem" }}
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "Ny här? Skapa ett konto"
          : "Har du redan ett konto? Logga in"}
      </button>
    </form>
  );
}
