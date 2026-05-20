import { initSafeArea } from './safeArea';
import { initStatusBar } from './statusBar';
import { initKeyboard } from './keyboard';
import { initDeepLinks } from './deepLinks';
import { initOTA } from './ota';
import { initPrivacyScreen } from './privacyScreen';
import { hideSplash } from './splashScreen';
import { isNative } from './platform';

// Single entry point called from index.tsx BEFORE React renders. Everything
// here is a no-op on web (each helper guards with isNative()) except safe-area
// + keyboard, which set CSS variables that the responsive web build also uses
// for consistent mobile layout.
export async function initNative(): Promise<void> {
    initSafeArea();
    initKeyboard();
    if (!isNative()) return;
    await Promise.allSettled([initStatusBar(), initDeepLinks(), initPrivacyScreen(), initOTA()]);
}

// Called from the vim shell after first paint, so the splash never reveals a
// blank WebView. Must be invoked exactly once per app lifetime.
export { hideSplash };
export { isNative, isIOS, isAndroid, getPlatform } from './platform';
export { setStatusBar } from './statusBar';
export { registerForPush } from './pushNotifications';
