// Minimal service worker — exists only to satisfy PWA installability criteria
// (Chrome requires a controlling SW with a fetch handler). No caching: admin
// and nalog both serve live, per-user data that must never be served stale.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network passthrough — no cache interception.
});
