import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNative } from './platform';

// OTA via Capgo. autoUpdate is enabled in capacitor.config so a new bundle is
// downloaded in the background on app launch; we just need to notify the
// runtime that the app is ready (so Capgo can finalize a pending install) and
// surface update events for an in-app toast.
//
// Important: register the event listeners BEFORE calling notifyAppReady() and
// `await` each addListener so the handlers are attached by the time Capgo
// emits its first event. Capgo may fire `updateAvailable` synchronously from
// notifyAppReady when a staged bundle is ready, and missing that event means
// the in-app toast never shows.
export async function initOTA(): Promise<void> {
    if (!isNative()) return;
    try {
        await CapacitorUpdater.addListener('updateAvailable', () => {
            window.dispatchEvent(new CustomEvent('vim:ota-available'));
        });
        await CapacitorUpdater.addListener('updateFailed', () => {
            window.dispatchEvent(new CustomEvent('vim:ota-failed'));
        });
        await CapacitorUpdater.addListener('downloadComplete', () => {
            // Bundle is staged; with `directUpdate: true` in capacitor.config,
            // Capgo applies it on the next app launch (NOT mid-session in v8+).
            window.dispatchEvent(new CustomEvent('vim:ota-downloaded'));
        });
        await CapacitorUpdater.notifyAppReady();
    } catch {
        // OTA failures must never block app start.
    }
}
