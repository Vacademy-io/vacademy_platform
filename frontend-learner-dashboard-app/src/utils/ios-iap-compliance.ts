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
 * Shell facts injected by the Electron preload (electron/src/preload.ts). Absent
 * on web, iOS and Android, so every read must tolerate `undefined`.
 */
interface VacademyShell {
  macAppStore?: boolean;
  windowsStore?: boolean;
}

/**
 * True when the Electron shell hosting this bundle is the Mac App Store package.
 *
 * This is the OTA-proof half of the gate. `__MAC_APP_STORE__` is compiled into
 * the JS, and OTA exists precisely to replace the JS — a bundle pulled from the
 * shared learner stream is built without that flag, so relying on it alone would
 * let the first OTA quietly re-enable commerce inside the store app (Guideline
 * 2.3.1 territory). The shell cannot be swapped by OTA, so asking it survives
 * every bundle update.
 */
const isMacAppStoreShell = (): boolean => {
  if (typeof window === "undefined") return false;
  return (window as Window & { vacademyShell?: VacademyShell }).vacademyShell?.macAppStore === true;
};

/**
 * True when this bundle is running as a MAC APP STORE app.
 *
 * Guideline 3.1.1 is not iOS-only — it applies to Mac App Store apps too, so a
 * MAS build must hide the same commerce surfaces the iOS build hides or it gets
 * rejected. It cannot be a plain platform check: the DMG (direct download) and
 * the MAS .pkg are the same Electron app on the same platform, and only the MAS
 * one is bound by the rule.
 *
 * Two independent signals, either of which turns reader mode on:
 *  - the build-time flag (VITE_MAC_APP_STORE=true), which covers the bundle
 *    packaged inside the .pkg; and
 *  - the shell flag above, which covers every bundle delivered later by OTA.
 *
 * Both default to false, so the DMG, Windows, web and Android keep full commerce.
 */
const isMacAppStoreBuild = (): boolean => __MAC_APP_STORE__ || isMacAppStoreShell();

/**
 * THE kill-switch. `true` ⇒ hide every paid / commerce / membership /
 * access-period surface. Native iOS always, plus Mac App Store builds; every
 * other platform/build shows commerce.
 */
export const shouldHidePaidPurchaseUI = (): boolean =>
  isIOSNative() || isMacAppStoreBuild();

/** Hook form of {@link shouldHidePaidPurchaseUI} for use inside components. */
export const useHidePaidPurchaseUI = (): boolean => shouldHidePaidPurchaseUI();

/**
 * True on builds distributed through an APPLE STORE (native iOS, and Mac App
 * Store packages). Distinct from {@link shouldHidePaidPurchaseUI} on purpose:
 * that one answers "hide commerce?" (3.1.1), this one answers "are we bound by
 * Apple's store rules at all?" — used for the 4.8 login rule.
 *
 * Guideline 4.8: an app offering third-party social login must ALSO offer a
 * privacy-preserving option (Sign in with Apple). The Mac App Store build was
 * rejected under 4.8 because the Apple button was gated on isIOSNative() — false
 * on Electron — while the Google/GitHub buttons could still render. Note their
 * defaults are `parsed?.allowGoogleAuth !== false`, so on a FRESH install (no
 * cached institute settings yet, exactly what a reviewer sees) they default to
 * shown. So the Mac build must not offer third-party login at all.
 */
export const isAppleStoreBuild = (): boolean =>
  isIOSNative() || isMacAppStoreBuild();

/**
 * True when third-party social login (Google/GitHub) must be hidden entirely.
 * Mac App Store only: iOS satisfies 4.8 by showing Sign in with Apple next to
 * them (native plugin), but that plugin has no Electron implementation, so the
 * Mac build complies by offering no third-party login at all.
 */
export const shouldHideThirdPartyLogin = (): boolean => isMacAppStoreBuild();
