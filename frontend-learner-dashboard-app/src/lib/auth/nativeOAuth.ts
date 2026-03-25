import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { getPlatformFlavorInfo } from "@/utils/platform-flavor";

let _cachedOrigin: string | null = null;

/**
 * Returns the public-facing origin URL for OAuth redirects.
 * - Web: window.location.origin (e.g. https://ssdc.vacademy.io)
 * - Native (Android/iOS): derived from flavor config (e.g. https://ssdc.vacademy.io)
 * - Electron: falls back to VITE_LEARNER_DASHBOARD_URL
 *
 * On native platforms window.location.origin resolves to capacitor://localhost
 * or http://localhost which the OAuth provider / backend cannot redirect back to.
 */
export async function getOAuthRedirectOrigin(): Promise<string> {
  if (_cachedOrigin) return _cachedOrigin;

  const platform = Capacitor.getPlatform();

  if (platform === "web") {
    _cachedOrigin = window.location.origin;
    return _cachedOrigin;
  }

  // Native (android / ios) or electron — derive from flavor config
  try {
    const platformInfo = await getPlatformFlavorInfo();
    if (platformInfo.flavorConfig) {
      const { domain, subdomain } = platformInfo.flavorConfig;
      _cachedOrigin = `https://${subdomain}.${domain}`;
      return _cachedOrigin;
    }
  } catch (e) {
    console.warn("[nativeOAuth] Failed to get flavor info, using fallback", e);
  }

  // Fallback
  _cachedOrigin =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (import.meta.env as any).VITE_LEARNER_DASHBOARD_URL ||
    "https://learner.vacademy.io";
  return _cachedOrigin;
}

/**
 * Whether the current platform requires the native OAuth flow
 * (system browser + deep-link callback instead of popup).
 */
export function isNativeOAuthRequired(): boolean {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

/**
 * Opens the OAuth URL in the system browser via Capacitor Browser plugin.
 * Used on native platforms where window.open() popups don't work.
 */
export async function openOAuthInSystemBrowser(url: string): Promise<void> {
  await Browser.open({ url, presentationStyle: "popover" });
}

/**
 * Closes the in-app browser opened by the Capacitor Browser plugin.
 */
export async function closeSystemBrowser(): Promise<void> {
  try {
    await Browser.close();
  } catch {
    // Browser.close() may throw if the browser is already closed
  }
}
