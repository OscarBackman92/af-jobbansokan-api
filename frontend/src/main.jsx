import React from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans/latin-500.css";
import "@fontsource/open-sans/latin-600.css";
import "@fontsource/inconsolata/latin-400.css";
import "@fontsource/inconsolata/latin-500.css";

import App from "./App.jsx";
import { ErrorBoundary, initSentry } from "./sentry.js";
import "./styles.css";

initSentry();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<p>Något gick fel. Ladda om sidan.</p>}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
