import React from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/inconsolata/400.css";
import "@fontsource/inconsolata/500.css";

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
