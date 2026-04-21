// Firebase messaging service worker for the admin dashboard.
// Mirrors the learner app's SW (same Firebase project) with admin-appropriate icons and default
// click-action. This file must be served at the app origin's root (/firebase-messaging-sw.js).

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyA-HYoXjokDTbPbrd5QT7Poe395TlmvHXw',
  authDomain: 'vacademy-app.firebaseapp.com',
  projectId: 'vacademy-app',
  storageBucket: 'vacademy-app.firebasestorage.app',
  messagingSenderId: '117550803134',
  appId: '1:117550803134:web:38c7763a12ef4f43bdd6ef',
  measurementId: 'G-CNY0GNB6Y4',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
    data: {
      ...payload.data,
      click_action: payload.notification?.click_action || payload.data?.click_action || '/',
    },
    tag: 'vacademy-admin-notification',
    requireInteraction: true,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);

  // Fan out to any open admin tabs so they can refresh in-app state.
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientList) => {
    clientList.forEach((client) => {
      try {
        client.postMessage({ type: 'FCM_BACKGROUND_MESSAGE', payload });
      } catch (_) {
        // ignore
      }
    });
  });
});

// Route the tap to the right admin route. The `click_action` can be a full path like
// `/study-library/doubt-management?doubtId=<id>`; the server sets this in pushData.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.click_action || '/dashboard';
  event.waitUntil(
    clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(clickAction);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
