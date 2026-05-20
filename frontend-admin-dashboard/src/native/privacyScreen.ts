import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import { isNative } from './platform';

// Privacy screen is enabled via capacitor.config but the plugin's runtime
// `enable()` is also required on some Android OEMs (notably Samsung One UI
// where the manifest flag is overridden by the recents service). Calling it
// here is idempotent and safe on iOS.
export async function initPrivacyScreen(): Promise<void> {
    if (!isNative()) return;
    try {
        await PrivacyScreen.enable();
    } catch {
        // ignore
    }
}
