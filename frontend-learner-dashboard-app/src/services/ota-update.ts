import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { BACKEND_BASE_URL } from "@/config/baseUrl";

const OTA_CHECK_URL = `${BACKEND_BASE_URL}/admin-core-service/public/ota/v1/check`;

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
  const current = await CapacitorUpdater.current();

  // If the plugin has an active OTA bundle, use its version.
  // Otherwise fall back to the native app version (first run / no OTA yet).
  const currentBundleVersion =
    current.bundle.version === "builtin"
      ? appInfo.version
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
 * MUST be called on every app start after the bundle loads successfully.
 * If not called within 10 seconds, the plugin auto-rolls back to the
 * previous working bundle (crash protection).
 */
export async function notifyUpdateSuccess(): Promise<void> {
  await CapacitorUpdater.notifyAppReady();
}
