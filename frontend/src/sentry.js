import { captureException, ErrorBoundary, init } from "@sentry/react";

export function initSentry() {
  const config = window.__ANSOKT_CONFIG__;
  if (!config?.sentryDsn) return;

  init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment || "production",
    tracesSampleRate: 0.05,
  });
}

export { captureException, ErrorBoundary };
