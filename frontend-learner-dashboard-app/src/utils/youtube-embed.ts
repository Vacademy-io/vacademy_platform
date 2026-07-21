/**
 * Helpers for embedding YouTube inside the Capacitor WebView / Electron shell.
 *
 * YouTube validates the embedding page's referrer/origin before it will play a
 * video. Native WebViews and the Electron shell expose a page origin that is NOT
 * an `http(s)` scheme, which YouTube rejects — surfacing as the infamous
 * **"Error 153"**:
 *   - iOS     → `capacitor://localhost`
 *   - Electron → `capacitor-electron://…` or `file://`
 *   - Android → `https://localhost` (already valid — that's why iOS-only reproduces)
 *
 * Normalising any non-`http(s)` origin to a valid `https` origin makes YouTube
 * accept the embed. We mirror Android's known-good `https://localhost`.
 */
export function getYouTubeEmbedOrigin(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Electron: keep the historically known-good http://localhost.
  if (origin.includes("capacitor-electron") || origin.includes("file://")) {
    return "http://localhost";
  }

  // iOS (capacitor://localhost) and any other non-http(s) scheme → Error 153.
  if (!/^https?:/.test(origin)) {
    return "https://localhost";
  }

  return origin;
}

/**
 * Appends the `origin` + `widget_referrer` params YouTube needs to validate a
 * raw `/embed/` iframe URL and avoid Error 153 on iOS/Electron. Preserves any
 * existing query string.
 */
export function appendYouTubeEmbedOrigin(embedUrl: string): string {
  const origin = getYouTubeEmbedOrigin();
  const params = new URLSearchParams({
    origin,
    widget_referrer: origin,
  });
  const separator = embedUrl.includes("?") ? "&" : "?";
  return `${embedUrl}${separator}${params.toString()}`;
}
