const cacheName = "littlenest-my-static-v16";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll([
      "/",
      "/auth_welcome/",
      "/login/",
      "/signup/",
      "/accept_invite/",
      "/home_dashboard/",
      "/quick_log/",
      "/calendar/",
      "/milestones/",
      "/assistant/",
      "/settings/",
      "/family_sharing/",
      "/growth_tracker/",
      "/mommy_guide/",
      "/privacy_safety/",
      "/manifest.json",
      "/src/utils/pwa-safe-area.css",
      "/src/utils/theme.css",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/apple-touch-icon.png"
    ]))
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
