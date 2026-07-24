import { toast } from 'sonner';
import {
    checkForOtaUpdate,
    downloadAndApplyUpdate,
    getOtaUpdateMode,
    notifyUpdateSuccess,
} from '@/services/ota-update';
import { useOtaUpdate } from '@/stores/useOtaUpdate';
import { isNative } from './platform';

// Self-hosted OTA lifecycle (learner-app style) for flavors whose OTA mode is
// `self-hosted`. Runs once at boot:
//   1. notifyAppReady() so the plugin marks the current bundle healthy and does
//      NOT auto-roll-back.
//   2. Ask our backend whether a newer bundle exists for this app/platform.
//   3. Force updates download + apply immediately (blocking overlay in the UI);
//      optional updates surface a dismissible banner via the OTA store.
export async function initSelfHostedOTA(): Promise<void> {
    if (!isNative()) return;

    try {
        await notifyUpdateSuccess();
    } catch {
        // notifyAppReady failing must never block app start.
    }

    try {
        const result = await checkForOtaUpdate();
        if (!result.update_available || !result.bundle_download_url) return;

        const { setOtaUpdate, setOtaDownloading, setOtaAutoUpdating } =
            useOtaUpdate.getState();

        // AUTO mode (fleet default): show a non-dismissible "Updating app…"
        // loader dialog, then download + apply the bundle in place. Runs at
        // launch only, so the set() reload never interrupts mid-session work.
        // Applies for both optional and force updates. Falls through to banner
        // mode if the backend omitted version/checksum (can't apply without them).
        const mode = await getOtaUpdateMode();
        if (mode === 'auto' && result.version && result.checksum) {
            try {
                setOtaAutoUpdating(true, result.version);
                await downloadAndApplyUpdate(
                    result.bundle_download_url,
                    result.version,
                    result.checksum
                );
                // set() reloads the app — code below only runs if it doesn't.
                setOtaAutoUpdating(false);
            } catch {
                setOtaAutoUpdating(false);
            }
            return;
        }

        // BANNER mode: dismissible banner (optional) or blocking overlay (force).
        setOtaUpdate({
            otaUpdateAvailable: true,
            otaVersion: result.version ?? null,
            otaDownloadUrl: result.bundle_download_url,
            otaChecksum: result.checksum ?? null,
            otaForceUpdate: result.force_update ?? false,
            otaReleaseNotes: result.release_notes ?? null,
        });

        if (result.force_update && result.version && result.checksum) {
            try {
                setOtaDownloading(true);
                await downloadAndApplyUpdate(
                    result.bundle_download_url,
                    result.version,
                    result.checksum
                );
                // set() reloads the app — code below only runs if it doesn't.
                setOtaDownloading(false);
            } catch {
                setOtaDownloading(false);
            }
        } else if (result.version) {
            toast.info(`Update ${result.version} available`);
        }
    } catch {
        // OTA check failures must never block app start.
    }
}
