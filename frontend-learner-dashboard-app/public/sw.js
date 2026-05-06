// Kill-switch service worker.
//
// The previous /sw.js used a cache-first strategy with no revalidation and
// cached /index.html on install — producing a white screen on production for
// users whose browsers had it registered, because the stale index.html kept
// pointing at chunk hashes that no longer existed on the CDN.
//
// This replacement:
//   1. Activates immediately (skipWaiting + clients.claim)
//   2. Deletes every cache this origin owns
//   3. Unregisters itself so future loads bypass the SW entirely
//   4. Reloads every open tab so it picks up the fresh bundle SW-free
//
// After ~24-48h (long enough for browsers to refetch the SW), this file and
// any registration code can be deleted. The push-notification SW lives at
// /firebase-messaging-sw.js and is unaffected.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();

      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      await self.registration.unregister();

      const windowClients = await self.clients.matchAll({ type: 'window' });
      for (const client of windowClients) {
        try {
          await client.navigate(client.url);
        } catch {
          // navigate() can reject for cross-origin or focus-restricted
          // clients; those tabs will recover on their next manual reload.
        }
      }
    } catch (err) {
      console.warn('[sw kill-switch] cleanup failed:', err);
    }
  })());
});

// No fetch handler — leaving fetches unintercepted is the whole point.
