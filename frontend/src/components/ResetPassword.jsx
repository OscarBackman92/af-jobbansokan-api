import { useState } from "react";

import { request } from "../api.js";
import PasswordInput from "./PasswordInput.jsx";

// Shown when the user arrives from the reset e-mail link
// (/?reset_uid=...&reset_token=...). Sets a new password via the
// dj-rest-auth confirm endpoint, then hands back to the login screen.
export default function ResetPassword({ uid, token, onDone }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== password2) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request("/dj-rest-auth/password/reset/confirm/", {
        method: "POST",
        auth: false,
        body: {
          uid,
          token,
          new_password1: password,
          new_password2: password2,
        },
      });
      setDone(true);
    } catch (err) {
      setError(
        err.status === 400
          ? "Länken är ogiltig eller har gått ut. Begär en ny återställning."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="hero centered">
        <div className="card narrow auth-card">
          <h2>Klart!</h2>
          <p className="muted">
            Ditt lösenord är uppdaterat. Logga in med det nya lösenordet.
          </p>
          <button onClick={onDone}>Till inloggningen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hero centered">
      <form className="card narrow auth-card" onSubmit={submit}>
        <h2>Välj ett nytt lösenord</h2>
        <p className="muted">Ange ditt nya lösenord nedan.</p>
        <div className="field">
          <label htmlFor="reset-password">Nytt lösenord</label>
          <PasswordInput
            id="reset-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reset-password-confirm">Bekräfta lösenord</label>
          <PasswordInput
            id="reset-password-confirm"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? "Sparar…" : "Spara nytt lösenord"}</button>
        <button
          type="button"
          className="linklike"
          style={{ marginTop: "0.8rem" }}
          onClick={onDone}
        >
          Avbryt
        </button>
      </form>
    </div>
  );
}
