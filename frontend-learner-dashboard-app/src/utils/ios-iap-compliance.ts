import { Capacitor } from "@capacitor/core";

/**
 * App-Store reader-app compliance gate (Apple Guideline 3.1.1 + 4.8).
 *
 * The native iOS app may not sell digital content through external payment
 * gateways (3.1.1), nor offer third-party social login without Sign in with
 * Apple (4.8). We comply by running iOS as a "reader app": every paid /
 * commerce / membership surface and the Google/GitHub login options are hidden
 * ON NATIVE iOS ONLY. Purchases happen on the web; the iOS app just unlocks
 * already-owned content.
 *
 * This is a pure runtime check of the current platform — no institute setting,
 * no remote flag, nothing to toggle later (a remotely re-enabled commerce/login
 * surface after review is exactly what gets an app pulled under Guideline
 * 2.3.1). Web, Android and desktop (Electron) are completely unaffected:
 * pricing, checkout and social login all work there.
 */

/** True only on a native iOS device / simulator. */
export const isIOSNative = (): boolean => Capacitor.getPlatform() === "ios";

/**
 * THE kill-switch. `true` ⇒ hide every paid / commerce / membership /
 * access-period surface. Native iOS only; every other platform shows commerce.
 */
export const shouldHidePaidPurchaseUI = (): boolean => isIOSNative();

/** Hook form of {@link shouldHidePaidPurchaseUI} for use inside components. */
export const useHidePaidPurchaseUI = (): boolean => shouldHidePaidPurchaseUI();
