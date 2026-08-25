import { Capacitor } from "@capacitor/core";

/**
 * Android's status bar is ~24dp. Used as a floor only when the bar is actually
 * on screen — see `topSafeAreaInset` for why the CSS inset alone isn't enough.
 */
const ANDROID_STATUS_BAR_FLOOR = "24px";

/**
 * Top padding for a full-bleed (`position: fixed`) assessment screen.
 *
 * Three things make this less obvious than `env(safe-area-inset-top)`:
 *
 * 1. A fixed element is laid out against the viewport, so the global
 *    `html, body` safe-area padding does not apply to it — each such screen has
 *    to re-apply the inset itself.
 * 2. The global rule subtracts 20px (`calc(env(...) - 20px)`). Copying that here
 *    is what put the exam header, and its Submit button, underneath the status
 *    bar: the app draws edge-to-edge, and Android's WebView reports this inset
 *    for the display cutout only — 0 on a phone without one — so there was
 *    nothing to take 20px from.
 * 3. With immersive mode on (Android), the status bar is gone and the cutout is
 *    the only intrusion left, so the raw inset is exactly right and a floor
 *    would just add dead space.
 *
 * iOS reports this inset accurately, so it always uses the raw value.
 */
export function topSafeAreaInset(immersiveActive: boolean): string {
  const raw = "env(safe-area-inset-top, 0px)";
  if (Capacitor.getPlatform() !== "android") return raw;
  return immersiveActive ? raw : `max(${raw}, ${ANDROID_STATUS_BAR_FLOOR})`;
}

/**
 * Bottom padding for a full-bleed assessment screen's sticky action bar.
 *
 * Android's WebView reports `env(safe-area-inset-bottom)` as 0 for the
 * navigation bar (it only reliably exposes display-cutout insets), so an
 * inset-only padding left the pager and Start/Submit buttons underneath the
 * three-button nav bar, untappable. The floor covers that.
 *
 * Once immersive mode has the nav bar down, that floor is 42px of dead space at
 * the bottom of every exam screen, so it drops to the same small gap iOS uses —
 * where the real inset (home indicator, ~34px) is reported correctly anyway.
 */
export function bottomSafeAreaInset(immersiveActive: boolean): string {
  const raw = "env(safe-area-inset-bottom, 0px)";
  const isAndroid = Capacitor.getPlatform() === "android";
  const floor = isAndroid && !immersiveActive ? "52px" : "10px";
  return `max(${raw}, ${floor})`;
}
