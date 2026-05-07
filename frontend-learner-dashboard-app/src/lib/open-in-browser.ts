import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

// Opens a URL in the system browser across all platforms:
//   Electron  → shell.openExternal via IPC (opens system browser, not a new Electron window)
//   iOS/Android → Capacitor Browser plugin
//   Web       → window.open
export async function openInBrowser(url: string): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openExternal) {
        await electronAPI.openExternal(url);
    } else if (Capacitor.isNativePlatform()) {
        await Browser.open({ url, presentationStyle: "fullscreen" });
    } else {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}
