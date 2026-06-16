import { useEffect } from 'react';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getUserId } from '@/utils/userDetails';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    getFirebaseToken,
    onFirebaseMessage,
    registerPushServiceWorker,
    requestNotificationPermission,
} from '@/services/firebase-config';

const REGISTER_URL = `${BASE_URL}/notification-service/push-notifications/register`;
const DEVICE_ID_KEY = 'vacademy.admin.deviceId';

// Module-level guards so calling `usePushNotifications` from multiple component trees (e.g. app
// root + settings page) doesn't attach duplicate onMessage listeners or re-run the boot path.
// Without this, users would see every foreground push toast twice.
let foregroundListenerAttached = false;
let bootPromise: Promise<void> | null = null;
let lastRegisteredToken: string | null = null;

const getOrCreateDeviceId = (): string => {
    try {
        const existing = localStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;
        const id = `admin-web-${crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
        localStorage.setItem(DEVICE_ID_KEY, id);
        return id;
    } catch {
        return `admin-web-${Date.now()}`;
    }
};

const registerTokenOnServer = async (token: string) => {
    const userId = getUserId();
    const instituteId = getCurrentInstituteId();
    if (!userId || !instituteId) return;
    if (lastRegisteredToken === token) return;

    try {
        await authenticatedAxiosInstance.post(REGISTER_URL, {
            userId,
            token,
            platform: 'WEB',
            deviceId: getOrCreateDeviceId(),
            instituteId,
        });
        lastRegisteredToken = token;
    } catch (e) {
        // FCM is nice-to-have, not a blocker — never surface.
        // eslint-disable-next-line no-console
        console.warn('FCM token registration failed:', e);
    }
};

const bootstrap = async (interactive: boolean): Promise<void> => {
    if (typeof Notification === 'undefined') return;

    // Skip the prompt outside a user gesture — browsers will reject Notification.requestPermission()
    // and some will permanently deny the site.
    if (Notification.permission === 'default') {
        if (!interactive) return;
        const result = await requestNotificationPermission();
        if (result !== 'granted') return;
    } else if (Notification.permission !== 'granted') {
        return;
    }

    await registerPushServiceWorker();
    const token = await getFirebaseToken();
    if (token) await registerTokenOnServer(token);
};

/**
 * Mounts the admin dashboard's FCM lifecycle ONCE globally. Safe to invoke from multiple
 * components — only the first call actually attaches the foreground onMessage listener and runs
 * the non-interactive bootstrap. Subsequent calls just return the shared {@code ensurePermission}
 * handle.
 *
 * Lifecycle:
 *   1. Registers the service worker.
 *   2. Bootstraps non-interactively on mount (idempotent).
 *   3. Subscribes to foreground messages and surfaces them as a toast.
 *   4. Exposes {@code ensurePermission} for a user-gesture flow (e.g. an "Enable push" button)
 *      that can be invoked from any consumer.
 */
export function usePushNotifications() {
    useEffect(() => {
        if (!bootPromise) bootPromise = bootstrap(false);

        if (!foregroundListenerAttached) {
            foregroundListenerAttached = true;
            onFirebaseMessage((payload) => {
                const title =
                    payload.notification?.title ||
                    (payload.data?.title as string | undefined) ||
                    'New notification';
                const body =
                    payload.notification?.body || (payload.data?.body as string | undefined);
                const conversationId = payload.data?.conversationId as string | undefined;
                const clickAction =
                    payload.data?.type === 'chat'
                        ? `/chat${conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''}`
                        : (payload.data?.click_action as string | undefined) ||
                          (payload.fcmOptions?.link as string | undefined);

                toast.info(title, {
                    description: body,
                    action: clickAction
                        ? {
                              label: 'Open',
                              onClick: () => {
                                  window.location.href = clickAction;
                              },
                          }
                        : undefined,
                });
            });
        }
        // Intentionally run once; shared state lives at module scope.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        /** Call from a user gesture (e.g. button onClick) to trigger the permission prompt. */
        ensurePermission: () => bootstrap(true),
    };
}
