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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message',
    icon: payload.notification?.icon || payload.data?.icon || '/icon-192.webp',
    badge: '/icon-128.webp',
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