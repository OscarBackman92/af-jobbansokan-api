import * as Sentry from "@sentry/react";

export function initSentry() {
  const config = window.__ANSOKT_CONFIG__;
  if (!config?.sentryDsn) return;

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment || "production",
    tracesSampleRate: 0.05,
  });
}

export { Sentry };
