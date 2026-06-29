import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { initSentry, Sentry } from "./sentry.js";
import "./styles.css";

initSentry();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Något gick fel. Ladda om sidan.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
