// Firebase messaging service worker
// This handles background push notifications for web

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
const firebaseConfig = {
  apiKey: "AIzaSyA-HYoXjokDTbPbrd5QT7Poe395TlmvHXw",
  authDomain: "vacademy-app.firebaseapp.com",
  projectId: "vacademy-app",
  storageBucket: "vacademy-app.firebasestorage.app",
  messagingSenderId: "117550803134",
  appId: "1:117550803134:web:38c7763a12ef4f43bdd6ef",
  measurementId: "G-CNY0GNB6Y4"
};

firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// ── Automatic white-label notification icon ────────────────────────────────
// A push notification is one of the most visible brand surfaces there is, and
// this worker used to hardcode /icon-192.webp — the Vacademy mark — so every
// white-label institute's learners got a Vacademy icon in their system tray.
//
// Rather than add yet another per-brand file to maintain by hand (see the
// orphaned firebase-messaging-sw.seven_cs.js), resolve the icon from
// /manifest.webmanifest. That endpoint is already generated per-hostname by
// functions/_middleware.ts, so any new white-label domain is branded the moment
// it is pointed at us — nothing to configure, nothing to remember.
const FALLBACK_ICON = '/icon-192.webp';
const FALLBACK_BADGE = '/icon-128.webp';

let brandIconPromise = null;

function resolveBrandIcon() {
  if (!brandIconPromise) {
    brandIconPromise = fetch('/manifest.webmanifest', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((manifest) => {
        const icons = (manifest && manifest.icons) || [];
        if (!icons.length) return null;
        // Largest declared icon wins — notification trays render at 2x-3x.
        const best = icons.reduce((acc, icon) => {
          const size = parseInt(String(icon.sizes || '0').split('x')[0], 10) || 0;
          return size > acc.size ? { size, src: icon.src } : acc;
        }, { size: 0, src: icons[0].src });
        return best.src || null;
      })
      .catch(() => null);
  }
  return brandIconPromise;
}

// Warm it at worker start-up so the message handler usually has it already.
resolveBrandIcon();

// Handle background messages
messaging.onBackgroundMessage(async (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const brandIcon = (await resolveBrandIcon()) || FALLBACK_ICON;
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message',
    icon: payload.notification?.icon || payload.data?.icon || brandIcon,
    badge: brandIcon || FALLBACK_BADGE,
    image: payload.notification?.image || payload.data?.image,
    data: {
      ...payload.data,
      click_action: payload.notification?.click_action || payload.data?.click_action || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true,
    tag: 'vacademy-notification'
  };

  // Show the system notification
  self.registration.showNotification(notificationTitle, notificationOptions);

  // Also forward the payload to all controlled clients so UI can update
  // (e.g., add to in-app notification list/toast when the tab is focused again)
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientList) => {
    clientList.forEach((client) => {
      try {
        client.postMessage({
          type: 'FCM_BACKGROUND_MESSAGE',
          payload,
          forwardedAt: Date.now()
        });
      } catch (e) {
        // ignore postMessage errors
      }
    });
  });
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Handle notification click - open the app
  const clickAction = event.notification.data?.click_action || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientList) => {
      // Check if a client is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(clickAction);
          return;
        }
      }
      
      // If no client is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installing...');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activating...');
  event.waitUntil(self.clients.claim());
}); 