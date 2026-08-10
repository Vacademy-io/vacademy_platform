/**
 * Thin wrapper around the custom `OfflineMedia` Capacitor plugin (plan §B1/B3/B4):
 *  - iOS: ios/App/App/OfflineMediaPlugin.swift + OfflineMediaSchemeHandler.swift +
 *    OfflineMediaCrypto.swift, registered via MainViewController.capacitorDidLoad().
 *  - Android: android/app/src/main/java/com/template/app/offlinemedia/*.java, registered via
 *    MainActivity.onCreate() -> registerPlugin(OfflineMediaPlugin.class).
 *  - Electron: electron/src/offline-media-plugin.ts (+ offline-media-crypto.ts), bridged via
 *    electron/src/rt/electron-plugins.js -> the existing @capacitor-community/electron
 *    ipcMain/contextBridge convention (electron-rt.ts), reachable here as the 'electron'
 *    jsImplementation below.
 *  - Web: unsupported (see src/lib/offline/platform.ts isOfflineSupported()) — every method
 *    degrades gracefully rather than throwing where a caller might not expect a rejection.
 *
 * This module is the single call surface the download engine (preflight.ts) and the video
 * resolver depend on — swapping/upgrading the native implementation is a one-file change here.
 *
 * IMPORTANT — nonce padding contract (do not remove): the JS downloader
 * (src/lib/offline/crypto/ctr.ts) stores a **12-byte** nonce per file in `assets.nonce`.
 * WebCrypto's AES-CTR counter block for that scheme is `nonce(12) || big-endian-uint32(blockIndex)`
 * (`length: 32`) — i.e. only the last 4 bytes of the 16-byte counter block increment; the nonce
 * prefix is fixed. All three native implementations (iOS/Android/Electron) treat their `nonce`
 * parameter as a **16-byte** value and increment it as a full big-endian 128-bit integer, which
 * is mathematically identical to the real WebCrypto rule for any realistic file size (blockIndex
 * never reaches 2^32) *provided* the 16-byte value they receive is exactly
 * `nonce(12) || 0x00000000` — never a randomly-generated 16-byte value, and never the raw
 * 12-byte DB value passed through unpadded. `openAsset` below performs that zero-padding; native
 * code must never be called with anything else. See docs/offline-media-plugin.md for the full
 * contract writeup and byte-for-byte-verified test vectors
 * (scripts/offline-media-test-vectors.ts).
 */

import { registerPlugin } from "@capacitor/core";

/** Free space on the device's app-private storage volume, in bytes. */
export interface FreeDiskSpace {
  freeBytes: number;
  /**
   * Native `OfflineMedia.getFreeDiskSpace()` only reports *free* bytes (see
   * docs/offline-media-plugin.md) — no platform API used here also returns total volume
   * capacity for "important usage" storage. Kept optional for backward compatibility with
   * earlier callers of this module; nothing in preflight.ts reads it today.
   */
  totalBytes?: number;
}

export interface OpenAssetRequest {
  /** Absolute path to the .enc file on disk. */
  path: string;
  /** Base64 raw AES-256 key bytes (not the CryptoKey object — plugin boundary is JS-primitive-only). */
  key: string;
  /**
   * Base64 **12-byte** CTR nonce as stored in `assets.nonce` (src/lib/offline/crypto/ctr.ts).
   * This is the raw DB value, NOT pre-padded — `openAsset` below pads it to 16 bytes before
   * it ever reaches native code.
   */
  nonce: string;
  /** Optional MIME type override; native code guesses video/mp4 (or video/webm for .webm) from the path extension otherwise. */
  mimeType?: string;
}

export interface OpenAssetResult {
  /** Opaque session token; pass to `closeAsset` on unmount/src change. */
  token: string;
  /**
   * Platform-specific playback URL, directly usable as an HTML5 `<video>` src:
   *  - iOS/Electron: `offline-media://<token>/stream`
   *  - Android: `http://127.0.0.1:<port>/<token>/stream`
   *  - Both support HTTP Range requests (seeking) and return proper Content-Range/206 responses.
   */
  url: string;
}

interface OfflineMediaPluginContract {
  getFreeDiskSpace(): Promise<{ bytes: number }>;
  openAsset(params: { path: string; keyB64: string; nonceB64: string; mimeType?: string }): Promise<OpenAssetResult>;
  closeAsset(params: { token: string }): Promise<void>;
}

/** Thrown by `openAsset`/`closeAsset` on platforms where the native plugin isn't available (web). */
export class OfflineMediaUnavailableError extends Error {
  constructor(method: string) {
    super(
      `OfflineMedia.${method} is not available on this platform (native plugin not registered — web is unsupported, see src/lib/offline/platform.ts)`
    );
    this.name = "OfflineMediaUnavailableError";
  }
}

const webFallback: OfflineMediaPluginContract = {
  async getFreeDiskSpace() {
    return { bytes: 0 };
  },
  async openAsset(): Promise<OpenAssetResult> {
    throw new OfflineMediaUnavailableError("openAsset");
  },
  async closeAsset() {
    // No-op: nothing was ever opened on web.
  },
};

/**
 * The registered plugin instance. Native (`ios`/`android`) implementations resolve
 * automatically via Capacitor's native bridge (pluginHeader-based dispatch) — no
 * `jsImplementations` entry needed for them, since `OfflineMediaPlugin` is registered as a real
 * `CAPPlugin`/`@CapacitorPlugin` on those platforms.
 *
 * Electron resolves via the explicit `electron` entry below, which reaches into
 * `window.CapacitorCustomPlatform.plugins.OfflineMedia` — the ipcRenderer bridge that
 * electron/src/rt/electron-rt.ts auto-generates from electron/src/rt/electron-plugins.js's
 * exported `OfflineMedia` class (see electron/src/offline-media-plugin.ts). Declaring this
 * explicitly (rather than relying on Capacitor's implicit "unknown custom platform falls back to
 * the web implementation" behavior) keeps Electron on its real native implementation instead of
 * silently degrading to `webFallback`.
 */
const OfflineMediaNative = registerPlugin<OfflineMediaPluginContract>("OfflineMedia", {
  web: () => webFallback,
  electron: () => {
    const bridge = (window as any).CapacitorCustomPlatform?.plugins?.OfflineMedia;
    if (!bridge) return webFallback;
    const impl: OfflineMediaPluginContract = {
      getFreeDiskSpace: (...args: any[]) => bridge.getFreeDiskSpace(...args),
      openAsset: (...args: any[]) => bridge.openAsset(...args),
      closeAsset: (...args: any[]) => bridge.closeAsset(...args),
    };
    return impl;
  },
});

let pluginAvailabilityChecked = false;
let pluginAvailable = false;

/**
 * True once the native OfflineMedia plugin is confirmed available on this platform (iOS,
 * Android, or Electron with the renderer bridge present). Callers should treat `false` as "no
 * streaming video / no real disk-space query available", not as an error condition — web is
 * expected to report `false` (see src/lib/offline/platform.ts isOfflineSupported()).
 */
export function isOfflineMediaPluginAvailable(): boolean {
  if (!pluginAvailabilityChecked) {
    pluginAvailabilityChecked = true;
    try {
      const platform = (window as any)?.Capacitor?.getPlatform?.();
      pluginAvailable = platform === "ios" || platform === "android" || platform === "electron";
    } catch {
      pluginAvailable = false;
    }
  }
  return pluginAvailable;
}

/**
 * Free/total space on the device's app-private storage volume, in bytes. Returns `null` when
 * the native plugin isn't available (web/dev) — callers must treat `null` as "unknown", not "0".
 */
export async function getFreeDiskSpace(): Promise<FreeDiskSpace | null> {
  if (!isOfflineMediaPluginAvailable()) return null;
  try {
    const { bytes } = await OfflineMediaNative.getFreeDiskSpace();
    return { freeBytes: bytes };
  } catch {
    return null;
  }
}

/** Base64-decoded byte length, without pulling in Buffer (must work in the WebView JS context too). */
function base64ByteLength(b64: string): number {
  const cleaned = b64.replace(/=+$/, "");
  return Math.floor((cleaned.length * 3) / 4);
}

/**
 * Zero-pads a base64-encoded 12-byte CTR nonce (as stored in `assets.nonce`) to the 16-byte
 * `nonce(12) || 0x00000000` form all three native implementations expect. See the module-level
 * doc comment for why this specific padding (not a random 16-byte value) is required for the
 * counter math to match the JS downloader's WebCrypto AES-CTR output.
 */
function padNonceTo16Bytes(nonce12B64: string): string {
  const byteLength = base64ByteLength(nonce12B64);
  if (byteLength !== 12) {
    throw new Error(`OfflineMedia.openAsset: expected a 12-byte base64 nonce (assets.nonce), got ${byteLength} bytes`);
  }
  const binary = atob(nonce12B64);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // bytes[12..15] stay 0x00000000 — the block-index suffix native code adds to, per request.
  let padded = "";
  for (let i = 0; i < bytes.length; i++) padded += String.fromCharCode(bytes[i]);
  return btoa(padded);
}

/**
 * Opens an encrypted asset for streaming playback via the native OfflineMedia scheme and
 * returns `{token, url}` — `url` is a ready-to-use `<video>` src (see `OpenAssetResult`).
 * Throws `OfflineMediaUnavailableError` on web; resolve.ts should treat that as
 * `unavailable-offline` rather than surfacing it as an unexpected error.
 */
export async function openAsset(request: OpenAssetRequest): Promise<OpenAssetResult> {
  if (!isOfflineMediaPluginAvailable()) {
    throw new OfflineMediaUnavailableError("openAsset");
  }
  const nonceB64 = padNonceTo16Bytes(request.nonce);
  return OfflineMediaNative.openAsset({
    path: request.path,
    keyB64: request.key,
    nonceB64,
    mimeType: request.mimeType,
  });
}

/** Zeroizes the in-memory key for a previously-opened asset token. Safe to call even if the plugin is unavailable (no-op). */
export async function closeAsset(token: string): Promise<void> {
  if (!isOfflineMediaPluginAvailable()) return;
  try {
    await OfflineMediaNative.closeAsset({ token });
  } catch {
    // Best-effort: closing an already-closed/unknown token should never throw into UI code.
  }
}
