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

export async function initStatusBar(): Promise<void> {
    // Vimotion default — paper white topbar, dark icons.
    await setStatusBar({ backgroundColor: '#FFFFFF', theme: 'dark-content' });
}
