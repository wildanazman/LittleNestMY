// Production error monitoring (Sentry), lazy + DSN-gated.
//
// Nothing loads unless VITE_SENTRY_DSN is set, so there's zero weight/cost
// until you opt in by adding a DSN. When set, the Sentry browser SDK is
// dynamically imported once and captures uncaught errors + unhandled
// promise rejections automatically.

import { runtimeEnv } from "../config/runtime-env.mjs";

const DSN = runtimeEnv.VITE_SENTRY_DSN || "";
let started = false;

export async function initErrorMonitor() {
  if (started || !DSN) return;
  started = true;
  try {
    const Sentry = await import("https://esm.sh/@sentry/browser@8.47.0");
    Sentry.init({
      dsn: DSN,
      environment: /localhost|127\.0\.0\.1/.test(location.hostname) ? "development" : "production",
      tracesSampleRate: 0,        // errors only — no performance tracing
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      // Drop noisy/irrelevant errors.
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Failed to fetch dynamically imported module",
        "Load failed"
      ]
    });
    window.__lnSentry = Sentry;
  } catch {
    // Monitoring is best-effort; never affect the app if it can't load.
  }
}
