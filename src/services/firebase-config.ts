import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';

type EnvMap = { [key: string]: string | undefined };
const ENV: EnvMap = (import.meta as unknown as { env: EnvMap }).env || {};

// Your Firebase configuration (env-driven with sensible defaults)
const firebaseConfig = {
  apiKey: ENV.VITE_FIREBASE_API_KEY || "AIzaSyA-HYoXjokDTbPbrd5QT7Poe395TlmvHXw",
  authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN || "vacademy-app.firebaseapp.com",
  projectId: ENV.VITE_FIREBASE_PROJECT_ID || "vacademy-app",
  storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET || "vacademy-app.firebasestorage.app",
  messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID || "117550803134",
  appId: ENV.VITE_FIREBASE_APP_ID || "1:117550803134:web:38c7763a12ef4f43bdd6ef",
  measurementId: ENV.VITE_FIREBASE_MEASUREMENT_ID || "G-CNY0GNB6Y4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics (only for web)
let analytics: Analytics | null = null;
if (Capacitor.getPlatform() === 'web') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.error('Error initializing Firebase analytics:', error);
  }
}

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging: Messaging | null = null;

// Only initialize messaging for web platform
if (Capacitor.getPlatform() === 'web') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error('Error initializing Firebase messaging:', error);
  }
}

export { messaging, analytics, app };

// Expose sender ID for server-side mapping (useful in multi-client setups)
export const FIREBASE_MESSAGING_SENDER_ID = firebaseConfig.messagingSenderId;

// VAPID key for web push notifications
// Get this from Firebase Console > Project Settings > Cloud Messaging > Web configuration > Web push certificates
// Generate a new key pair and copy the key here
export const VAPID_KEY = ENV.VITE_FIREBASE_VAPID_KEY || "BCeQVrW8MTGLjYifcNnFDmP8dTYJQaGjCiZWY-N0wCbHkNwIM5udkr8l2WlIG7YeZx4b2sqe9tl0qaHNIOxb8a8";

// Get FCM token for web
export const getFirebaseToken = async (): Promise<string | null> => {
  if (!messaging || Capacitor.getPlatform() !== 'web') {
    return null;
  }

  // Handle permission states explicitly to avoid getToken errors
  const currentPermission = Notification.permission;

  // If already denied, do not attempt to retrieve token
  if (currentPermission === 'denied') {
    console.warn('Push Notifications are blocked by the user. Token retrieval skipped.');
    return null;
  }

  // If permission is default (not yet asked), you may trigger a request here
  // but leave it to calling code; just return null
  if (currentPermission === 'default') {
    console.info('Push Notification permission is not granted yet. Token retrieval deferred.');
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY
    });
    
    if (token) {
      console.log('Firebase token generated:', token);
      return token;
    } else {
      console.log('No registration token available.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving token:', error);
    return null;
  }
};

// Listen for foreground messages (web only)
export const onFirebaseMessage = (callback: (payload: MessagePayload) => void) => {
  if (!messaging || Capacitor.getPlatform() !== 'web') {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    callback(payload);
  });
};

// Service Worker registration for web push
export const registerServiceWorker = async () => {
  if (Capacitor.getPlatform() !== 'web' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered successfully:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}; 