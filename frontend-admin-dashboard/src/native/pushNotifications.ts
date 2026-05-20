import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { isNative } from './platform';

// Token registration is intentionally lazy — we wait until the user has
// authenticated (cookie present) before requesting permission, otherwise the
// permission prompt fires on first launch with no context. The auth layer
// calls `registerForPush()` after a successful login/signup.
let registered = false;

export async function registerForPush(): Promise<string | null> {
    if (!isNative() || registered) return null;
    try {
        const perm = await FirebaseMessaging.requestPermissions();
        if (perm.receive !== 'granted') return null;

        const { token } = await FirebaseMessaging.getToken();
        registered = true;

        // Foreground delivery — the OS does not show a banner by default for
        // foreground pushes, so we forward them to a custom in-app toast.
        FirebaseMessaging.addListener('notificationReceived', (event) => {
            window.dispatchEvent(
                new CustomEvent('vim:push-received', { detail: event.notification })
            );
        });
        // Tap handler — routes the user to the deep-link target.
        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            const url = (event.notification?.data as { url?: string } | undefined)?.url;
            if (url) {
                window.dispatchEvent(new CustomEvent('vim:push-tapped', { detail: url }));
            }
        });

        return token ?? null;
    } catch {
        return null;
    }
}
