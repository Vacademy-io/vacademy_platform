import { Capacitor, registerPlugin } from "@capacitor/core";

interface ImmersivePluginDefinition {
  /** Hide the Android status bar and navigation bar. */
  enable(): Promise<void>;
  /** Restore both system bars. */
  disable(): Promise<void>;
}

/**
 * Android-only immersive mode, backed by the in-repo `ImmersivePlugin`
 * (see `android/app/src/main/java/com/template/app/immersive/ImmersivePlugin.java`).
 *
 * Used by the live assessment shell. The app draws edge-to-edge, so without this
 * the system bars sit on top of the exam's own header and footer — and the
 * status bar is not something the WebView can pad around reliably, because
 * Android's WebView reports `env(safe-area-inset-top)` for the display cutout
 * only, not for the bar itself.
 *
 * Every call is a no-op off Android, and failures are swallowed: an older bundle
 * running against a native shell without the plugin registered must still be
 * able to run an exam.
 */
const Immersive = registerPlugin<ImmersivePluginDefinition>("Immersive");

const isSupported = () => Capacitor.getPlatform() === "android";

/**
 * Returns whether the system bars are actually hidden. Callers use this to
 * decide how much top inset to reserve: with the bars down the display cutout
 * is the only intrusion, but on a native shell that predates this plugin (an
 * OTA bundle can outlive the APK it shipped in) the status bar is still there
 * and the header has to pad around it.
 */
export async function enableImmersiveMode(): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    await Immersive.enable();
    return true;
  } catch (error) {
    console.warn("Immersive mode unavailable:", error);
    return false;
  }
}

export async function disableImmersiveMode(): Promise<void> {
  if (!isSupported()) return;
  try {
    await Immersive.disable();
  } catch (error) {
    console.warn("Could not restore system bars:", error);
  }
}
