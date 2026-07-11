import { useEffect, useState } from "react";

import { request } from "../api.js";

// Shown when the user arrives from the verification e-mail link
// (/?verify_key=...). Confirms the address via dj-rest-auth, then
// hands back to the login screen.
export default function VerifyEmail({ verifyKey, onDone }) {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function confirm() {
      try {
        await request("/dj-rest-auth/registration/verify-email/", {
          method: "POST",
          auth: false,
          body: { key: verifyKey },
        });
        if (!cancelled) setDone(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.status === 400
              ? "Länken är ogiltig eller har gått ut. Registrera dig igen eller begär ett nytt mejl."
              : err.message
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    confirm();
    return () => {
      cancelled = true;
    };
  }, [verifyKey]);

  if (busy) {
    return (
      <div className="hero centered">
        <div className="card narrow auth-card">
          <h2>Verifierar e-post…</h2>
          <p className="muted">Ett ögonblick medan vi bekräftar din adress.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="hero centered">
        <div className="card narrow auth-card">
          <h2>E-post bekräftad!</h2>
          <p className="muted">
            Din adress är verifierad. Logga in med e-post och lösenord.
          </p>
          <button onClick={onDone}>Till inloggningen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hero centered">
      <div className="card narrow auth-card">
        <h2>Verifieringen misslyckades</h2>
        <p className="error">{error}</p>
        <button onClick={onDone}>Till inloggningen</button>
      </div>
    </div>
  );
}
