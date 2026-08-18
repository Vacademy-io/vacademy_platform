import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { enableImmersiveMode, disableImmersiveMode } from "@/utils/immersive";
import { useLiveTestStore } from "@/stores/live-test-store";

/**
 * Hide Android's status and navigation bars while a screen is mounted.
 *
 * The app draws edge-to-edge (`setDecorFitsSystemWindows(false)` in
 * MainActivity), so on the assessment screens both system bars sit on top of
 * the app's own header and footer. Padding around them is not a reliable fix:
 * Android's WebView reports `env(safe-area-inset-top)` for the display cutout
 * only, so on a phone without one it is 0 while the status bar is still ~24dp
 * tall. Taking the bars down is what actually clears the safe zone.
 *
 * Android restores the bars after some system interactions (permission prompts,
 * the app switcher), so this re-asserts on resume rather than trusting the
 * initial call to stick. No-op on every other platform.
 */
export function useImmersiveMode(enabled: boolean): void {
  const setImmersiveActive = useLiveTestStore((s) => s.setImmersiveActive);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const assert = async () => {
      const active = await enableImmersiveMode();
      if (!cancelled) setImmersiveActive(active);
    };
    void assert();

    let listener: { remove: () => void } | null = null;
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void assert();
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      cancelled = true;
      listener?.remove();
      setImmersiveActive(false);
      void disableImmersiveMode();
    };
  }, [enabled, setImmersiveActive]);
}
