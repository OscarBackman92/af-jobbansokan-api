import { useEffect, useState } from "react";

import { request } from "../api.js";

// Shown when the user lands back from Google's consent screen
// (/?code=...&state=...). Exchanges the code for our JWT pair.
export default function GoogleSignIn({ code, onLogin, onDone }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function exchange() {
      try {
        const data = await request("/dj-rest-auth/google/", {
          method: "POST",
          auth: false,
          body: { code },
        });
        if (!cancelled) onLogin({ access: data.access, refresh: data.refresh });
      } catch (err) {
        if (!cancelled) setError(err.message || "Inloggningen misslyckades.");
      }
    }

    exchange();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (error) {
    return (
      <div className="hero centered">
        <div className="card narrow auth-card">
          <h2>Google-inloggningen misslyckades</h2>
          <p className="error">{error}</p>
          <button onClick={onDone}>Till inloggningen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hero centered">
      <div className="card narrow auth-card">
        <h2>Loggar in med Google…</h2>
        <p className="muted">Ett ögonblick medan vi slutför inloggningen.</p>
      </div>
    </div>
  );
}
