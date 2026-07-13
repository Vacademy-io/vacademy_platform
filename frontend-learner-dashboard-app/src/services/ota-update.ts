import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { App } from "@/utils/app-plugin";
import { Capacitor } from "@capacitor/core";
import { BACKEND_BASE_URL } from "@/config/baseUrl";

const OTA_CHECK_URL = `${BACKEND_BASE_URL}/admin-core-service/public/ota/v1/check`;

// App ids that OPT OUT of OTA entirely — they are distributed only via the app
// store and must never ride the shared learner OTA stream (whose fleet-wide
// "all apps" bundles would otherwise surface as an update banner). Sadbhavana
// is a newly-registered App Store app the user releases manually, not via OTA.
const OTA_DISABLED_APP_IDS = new Set<string>([
  "io.sadbhavana.com",
]);

// ALL native institute apps apply OTA updates SILENTLY in the background: the
// new bundle is downloaded and staged with next() so it activates on the next
// natural app restart/resume — NO banner, NO toast, NO mid-session reload. This
// is deliberate for a learner/exam app: an immediate set() reload would wipe a
// student's in-progress attempt. Apps that must not OTA at all are handled
// earlier via OTA_DISABLED_APP_IDS (checkForOtaUpdate returns no-update for
// them, so they never reach the silent path).
//
// NOTE (bootstrap): the silent behavior ships IN the bundle, so the FIRST OTA a
// device receives is still handled by whatever JS it currently runs; every
// update AFTER that is silent.

/**
 * Whether the running app should apply OTA updates silently (download + stage
 * for next restart) instead of surfacing a banner/toast. True for every native
 * build; web/electron return false (no OTA there).
 */
export async function isSilentOtaApp(): Promise<boolean> {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

export interface OtaCheckResponse {
  update_available: boolean;
  version?: string;
  bundle_download_url?: string;
  checksum?: string;
  bundle_size_bytes?: number;
  force_update?: boolean;
  release_notes?: string;
}

/**
 * Check our backend for a new OTA bundle version.
 * Only runs on Android/iOS — returns no-update on web/electron.
 */
export async function checkForOtaUpdate(): Promise<OtaCheckResponse> {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") {
    return { update_available: false };
  }

  const appInfo = await App.getInfo();

  // Opt-out apps (e.g. Sadbhavana) never show the OTA banner.
  if (OTA_DISABLED_APP_IDS.has(appInfo.id)) {
    return { update_available: false };
  }

  const current = await CapacitorUpdater.current();

  // If the plugin has an active OTA bundle, use its version. Otherwise (first
  // run / no OTA applied yet) fall back to the EMBEDDED JS bundle version
  // (__APP_VERSION__, injected from package.json) — NOT the native app version.
  // The native version (e.g. iOS MARKETING_VERSION 1.0.x) lives in a different
  // numbering space than OTA bundles (2.2.x); using it made every published
  // bundle look newer and surfaced a false "update available" banner that, if
  // tapped, would downgrade the embedded JS.
  const currentBundleVersion =
    current.bundle.version === "builtin"
      ? __APP_VERSION__
      : current.bundle.version;

  const params = new URLSearchParams({
    platform: platform.toUpperCase(),
    currentBundleVersion,
    nativeVersion: appInfo.version,
    appId: appInfo.id,
  });

  const response = await fetch(`${OTA_CHECK_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`OTA check failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Download a bundle zip and stage it for the next app restart.
 */
export async function downloadAndApplyUpdate(
  bundleDownloadUrl: string,
  version: string,
  checksum: string,
): Promise<void> {
  const bundle = await CapacitorUpdater.download({
    url: bundleDownloadUrl,
    version,
    checksum,
  });

  // set() applies the bundle and reloads the WebView immediately
  await CapacitorUpdater.set(bundle);
}

/**
 * Download a bundle zip and STAGE it for the next app restart/resume via next().
 * Unlike downloadAndApplyUpdate (set = immediate reload), this never reloads the
 * WebView mid-session — the staged bundle activates silently the next time the
 * app is backgrounded/relaunched. No UI is shown. Used by the silent OTA path.
 */
export async function downloadAndStageUpdate(
  bundleDownloadUrl: string,
  version: string,
  checksum: string,
): Promise<void> {
  const bundle = await CapacitorUpdater.download({
    url: bundleDownloadUrl,
    version,
    checksum,
  });

  // next() activates the bundle on the next app background/relaunch — no reload now.
  await CapacitorUpdater.next({ id: bundle.id });
}

/**
 * MUST be called on every app start after the bundle loads successfully.
 * If not called within 10 seconds, the plugin auto-rolls back to the
 * previous working bundle (crash protection).
 */
export async function notifyUpdateSuccess(): Promise<void> {
  await CapacitorUpdater.notifyAppReady();
}
