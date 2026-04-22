import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';

type EnvMap = { [key: string]: string | undefined };
const ENV: EnvMap = (import.meta as unknown as { env: EnvMap }).env || {};

// Shared Firebase project with the learner dashboard (vacademy-app). Env vars take precedence if
// the admin app is ever deployed against a different project.
const firebaseConfig = {
    apiKey: ENV.VITE_FIREBASE_API_KEY || 'AIzaSyA-HYoXjokDTbPbrd5QT7Poe395TlmvHXw',
    authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN || 'vacademy-app.firebaseapp.com',
    projectId: ENV.VITE_FIREBASE_PROJECT_ID || 'vacademy-app',
    storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET || 'vacademy-app.firebasestorage.app',
    messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID || '117550803134',
    appId: ENV.VITE_FIREBASE_APP_ID || '1:117550803134:web:38c7763a12ef4f43bdd6ef',
    measurementId: ENV.VITE_FIREBASE_MEASUREMENT_ID || 'G-CNY0GNB6Y4',
};

// VAPID web-push certificate key (Firebase Console → Cloud Messaging → Web push certificates).
export const VAPID_KEY =
    ENV.VITE_FIREBASE_VAPID_KEY ||
    'BCeQVrW8MTGLjYifcNnFDmP8dTYJQaGjCiZWY-N0wCbHkNwIM5udkr8l2WlIG7YeZx4b2sqe9tl0qaHNIOxb8a8';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let messaging: Messaging | null = null;
try {
    if (typeof window !== 'undefined') {
        messaging = getMessaging(app);
    }
} catch (e) {
    // Messaging init can throw in unsupported browsers; fine to keep null.
    // eslint-disable-next-line no-console
    console.warn('Firebase messaging unavailable in this environment:', e);
}

/**
 * Returns an FCM registration token for the current browser, or null if the browser doesn't
 * support push, permission is denied, or the SW isn't registered yet. Caller is responsible for
 * POSTing the returned token to the backend.
 */
export const getFirebaseToken = async (): Promise<string | null> => {
    if (!messaging || typeof window === 'undefined') return null;
    if (typeof Notification === 'undefined') return null;
    if (Notification.permission !== 'granted') return null;

    try {
        let swRegistration: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) || undefined;
            } catch {
                // ignore
            }
        }
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
        return token || null;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to retrieve FCM token:', e);
        return null;
    }
};

export const onFirebaseMessage = (callback: (payload: MessagePayload) => void) => {
    if (!messaging) return () => {};
    return onMessage(messaging, callback);
};

export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
        // Re-use any existing registration to avoid double-registering on HMR reloads.
        const existing = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (existing) return existing;
        return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('firebase-messaging-sw.js registration failed:', e);
        return null;
    }
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
        return Notification.permission;
    }
    return Notification.requestPermission();
};
