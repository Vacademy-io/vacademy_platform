import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { OTA_CHECK } from '@/constants/urls';

// Self-hosted OTA against our admin-core OTA backend (the same backend the
// learner app uses). The Capgo plugin is configured with `autoUpdate: false`
// for this flavor, so we drive the whole lifecycle: check -> download -> set
// (reload) -> notifyAppReady (crash-rollback guard).

// How a native app surfaces an available OTA bundle. Two live modes:
//   "auto"   — show a non-dismissible "Updating app…" loader dialog on launch,
//              then download + apply the bundle in place (set → WebView reload).
//              Runs at launch ONLY, so it never reloads mid-session.
//   "banner" — dismissible "Update X available" banner (or a blocking "Update
//              required" overlay for force updates); the user taps to apply.
export type OtaUpdateMode = 'auto' | 'banner';

// Fleet-wide default. Flip this one constant to change the default for every
// self-hosted-OTA admin flavor; list an app id in BANNER_OTA_APP_IDS to send
// that app back to the dismissible banner instead.
const DEFAULT_OTA_MODE: OtaUpdateMode = 'auto';
const BANNER_OTA_APP_IDS = new Set<string>([
    // e.g. 'io.vacademy.admin.app',
]);

/**
 * Resolve the OTA update mode for the currently running app. Returns the fleet
 * default (DEFAULT_OTA_MODE) unless this app id is explicitly listed in
 * BANNER_OTA_APP_IDS.
 */
export async function getOtaUpdateMode(): Promise<OtaUpdateMode> {
    const appInfo = await App.getInfo();
    return BANNER_OTA_APP_IDS.has(appInfo.id) ? 'banner' : DEFAULT_OTA_MODE;
}

export interface OtaCheckResponse {
    update_available: boolean;
    version?: string;
    bundle_download_url?: string;
    checksum?: string;
    bundle_size_bytes?: number;
    force_update?: boolean;
    release_notes?: string;
    target_app_ids?: string;
}

/**
 * Check our backend for a new OTA bundle version.
 * Only runs on Android/iOS — returns no-update on web/electron.
 */
export async function checkForOtaUpdate(): Promise<OtaCheckResponse> {
    const platform = Capacitor.getPlatform();
    if (platform !== 'android' && platform !== 'ios') {
        return { update_available: false };
    }

    const appInfo = await App.getInfo();
    const current = await CapacitorUpdater.current();

    // If the plugin has an active OTA bundle, use its version. Otherwise fall
    // back to the native app version (first run / no OTA yet).
    const currentBundleVersion =
        current.bundle.version === 'builtin' ? appInfo.version : current.bundle.version;

    const params = new URLSearchParams({
        platform: platform.toUpperCase(),
        currentBundleVersion,
        nativeVersion: appInfo.version,
        appId: appInfo.id,
    });

    const response = await fetch(`${OTA_CHECK}?${params}`);
    if (!response.ok) {
        throw new Error(`OTA check failed: ${response.status}`);
    }
    const result: OtaCheckResponse = await response.json();

    // Defense-in-depth: only ever apply a bundle EXPLICITLY targeted to this
    // app id. The OTA backend is shared with other apps (e.g. the learner app,
    // whose bundles are untargeted = "all apps"). Even if the backend were
    // misconfigured to hand us an untargeted/foreign bundle, refuse it here so
    // we can never load another app's JS into this WebView.
    if (result.update_available) {
        const targets = (result.target_app_ids ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        if (!targets.includes(appInfo.id)) {
            return { update_available: false };
        }
    }
    return result;
}

/**
 * Download a bundle zip and apply it. `set()` reloads the WebView immediately.
 */
export async function downloadAndApplyUpdate(
    bundleDownloadUrl: string,
    version: string,
    checksum: string
): Promise<void> {
    const bundle = await CapacitorUpdater.download({
        url: bundleDownloadUrl,
        version,
        checksum,
    });
    await CapacitorUpdater.set(bundle);
}

/**
 * MUST be called on every app start after the bundle loads successfully. If not
 * called within the plugin's timeout, it auto-rolls back to the previous working
 * bundle (crash protection).
 */
export async function notifyUpdateSuccess(): Promise<void> {
    await CapacitorUpdater.notifyAppReady();
}
