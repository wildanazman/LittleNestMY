const cacheName = "littlenest-my-static-v23";

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

function networkFirst(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) caches.match(request).then((cached) => {
        if (cached) { resolved = true; resolve(cached); }
      });
    }, timeoutMs);
    fetch(request).then((response) => {
      if (resolved) return;
      clearTimeout(timer);
      resolved = true;
      if (response.ok && new URL(request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      resolve(response);
    }).catch((err) => {
      if (!resolved) { clearTimeout(timer); reject(err); }
    });
  });
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

  // Same-origin: network-first with 5s timeout. If network is slow, fall
  // back to cache immediately so the app doesn't stall on mobile data.
  event.respondWith(
    networkFirst(request, 5000)
      .catch(() =>
        caches.match(request).then((cached) =>
          cached || (request.mode === "navigate" ? caches.match("/home_dashboard/") : Response.error())
        )
      )
  );
});

// Web Push: show the reminder the cron sent, even when the app is closed.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "LittleNest MY", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "LittleNest MY";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "littlenest-reminder",
    data: { url: payload.url || "/home_dashboard/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url ? event.notification.data.url : "/home_dashboard/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
