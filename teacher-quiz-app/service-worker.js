// Minimal service worker — exists only to satisfy the "installable PWA"
// criteria some browsers check for. Deliberately does NOT cache anything:
// this app talks to live Firestore data and this project has already hit
// real stale-cache bugs before, so caching the app shell here would risk
// serving old JS/CSS after every update.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally not calling event.respondWith — every request goes
  // straight to the network, same as if there were no service worker.
});
