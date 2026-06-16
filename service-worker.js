const cacheName = "littlenest-my-static-v17";

// Same-origin app shell precached on install. Best-effort per item so one
// missing route never fails the whole install.
const precacheUrls = [
  "/",
  "/auth_welcome/",
  "/login/",
  "/signup/",
  "/accept_invite/",
  "/set_password/",
  "/onboarding/",
  "/add_baby_profile/",
  "/baby_profiles/",
  "/home_dashboard/",
  "/quick_log/",
  "/feeding_log/",
  "/sleep_log/",
  "/diaper_log/",
  "/health_records/",
  "/mama_care/",
  "/daily_summary/",
  "/calendar/",
  "/growth_tracker/",
  "/weekly_insights/",
  "/doctor_report/",
  "/milestones/",
  "/memory_book/",
  "/assistant/",
  "/family_sharing/",
  "/mommy_guide/",
  "/privacy_safety/",
  "/settings/",
  "/manifest.json",
  "/src/utils/pwa-safe-area.css",
  "/src/utils/theme.css",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/placeholder.svg",
  "/icons/littlenest-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) =>
      Promise.all(precacheUrls.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cross-origin static deps (Tailwind CDN, Google Fonts) are versioned/immutable —
// cache-first so the app stays styled offline after the first visit.
function isCacheFirstAsset(url) {
  return /(^|\.)cdn\.tailwindcss\.com$/.test(url.hostname)
    || /(^|\.)fonts\.googleapis\.com$/.test(url.hostname)
    || /(^|\.)fonts\.gstatic\.com$/.test(url.hostname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Cache-first for CDN/font assets.
  if (isCacheFirstAsset(url)) {
    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Same-origin: network-first (fresh while online), fall back to cache offline,
  // and keep the cache warm so the next offline load works.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) =>
          cached || (request.mode === "navigate" ? caches.match("/home_dashboard/") : Response.error())
        )
      )
  );
});
