/**
 * Offline-feature platform gate (plan §B1 "Platform scoping").
 *
 * Offline content download/sync is supported on native iOS/Android and on the
 * Electron desktop app. Plain web is explicitly out of scope: `index.html` /
 * `public/sw.js` actively nuke caches/service workers on every load, and
 * logout wipes IndexedDB — both make persistent offline storage hostile on
 * that platform. Keeping the gate in one place means every offline entry
 * point (download buttons, sync engine, lease loop) can short-circuit
 * identically instead of re-deriving platform checks.
 */

import { Capacitor } from "@capacitor/core";

/** Platforms Capacitor can report via `Capacitor.getPlatform()`. */
export type CapacitorPlatform = "ios" | "android" | "electron" | "web";

/**
 * Feature flag for the whole offline subsystem. Flip to `false` to kill-switch
 * offline download/sync app-wide (e.g. mid-rollout) without touching call
 * sites — every offline entry point should gate on `isOfflineSupported()`,
 * which already folds this flag in.
 */
export const OFFLINE_FEATURE_ENABLED = true;

/**
 * The @capacitor-community/electron runtime reports `Capacitor.getPlatform()`
 * as `"electron"` once the Electron preload wires up the Capacitor bridge.
 * Some Electron integrations only expose this via `window.Capacitor.platform`
 * before the bridge fully initializes, so we defensively check both.
 */
const readPlatform = (): CapacitorPlatform => {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === "ios" || platform === "android" || platform === "electron") {
      return platform;
    }
  } catch {
    // Capacitor not available (SSR/test) — fall through to web.
  }
  return "web";
};

/** Current runtime platform, per Capacitor. */
export const getCurrentPlatform = (): CapacitorPlatform => readPlatform();

/**
 * True when the current runtime can support offline content download + sync:
 * native iOS/Android (`Capacitor.isNativePlatform()`) or the Electron desktop
 * app. False on plain web, even inside a mobile browser.
 */
export const isOfflineSupported = (): boolean => {
  if (!OFFLINE_FEATURE_ENABLED) return false;

  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // Capacitor not available — treat as unsupported.
  }

  return readPlatform() === "electron";
};
