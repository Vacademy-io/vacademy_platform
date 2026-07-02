import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative, isAndroid } from './platform';

// Vimotion brand chrome — paper white background + dark icons. Matches the
// Topbar so the status bar visually fuses with the in-app header. We expose
// `setVimotionStatusBar` so screens with a different background (e.g. the
// editor mobile gate on the splash off-white) can override at mount time.
export type StatusBarTheme = 'light-content' | 'dark-content';

export async function setStatusBar(opts: {
    backgroundColor: string;
    theme: StatusBarTheme;
}): Promise<void> {
    if (!isNative()) return;
    try {
        await StatusBar.setStyle({
            style: opts.theme === 'dark-content' ? Style.Light : Style.Dark,
        });
        if (isAndroid()) {
            await StatusBar.setBackgroundColor({ color: opts.backgroundColor });
        }
        await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
        // Status bar setup is best-effort; never block app boot on it.
    }
}

function deviceIsDark(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export async function initStatusBar(): Promise<void> {
    // Follow the DEVICE/OS theme (not the app theme) so the status-bar icons stay
    // readable against the cover strip (src/index.css --system-bar-cover): dark
    // icons on a white strip in light mode, light icons on a black strip in dark
    // mode. Re-applies when the device theme is toggled while the app is open.
    const applyForDevice = () =>
        setStatusBar(
            deviceIsDark()
                ? { backgroundColor: '#000000', theme: 'light-content' } // design-lint-ignore: native StatusBar API requires a hex string
                : { backgroundColor: '#FFFFFF', theme: 'dark-content' } // design-lint-ignore: native StatusBar API requires a hex string
        );
    await applyForDevice();
    if (typeof window !== 'undefined') {
        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
            void applyForDevice();
        });
    }
}
