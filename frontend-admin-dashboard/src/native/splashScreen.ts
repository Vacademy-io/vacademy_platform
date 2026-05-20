import { SplashScreen } from '@capacitor/splash-screen';
import { isNative } from './platform';

// `useVimotionNativeShell` is mounted in multiple vim screens (Login,
// Onboarding, Dashboard, the editor mobile gate). Each one tries to hide the
// splash on first paint, which means `SplashScreen.hide()` would be called
// several times in quick succession on a login → dashboard transition. The
// upstream plugin is idempotent in theory, but rapid concurrent calls have
// caused flicker on Android in the wild — so we guard at the module level.
let splashHidden = false;

export async function hideSplash(): Promise<void> {
    if (splashHidden) return;
    splashHidden = true;
    if (!isNative()) return;
    try {
        await SplashScreen.hide({ fadeOutDuration: 200 });
    } catch {
        // Failures here can't be recovered from and shouldn't block the app —
        // worst case the native splash auto-hides via Capacitor's default
        // timeout fallback.
    }
}
