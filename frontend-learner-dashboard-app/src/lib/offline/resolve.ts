/**
 * Slide source resolver (plan §B4). Single decision point every playback
 * touch point calls instead of `getPublicUrl` directly, so online vs.
 * offline vs. locked vs. unavailable logic lives in one place.
 *
 * Online → always `remote` (the offline copy, if any, is left untouched —
 * per plan "Online → always remote"). Offline → decrypt a local `.enc` file
 * to a Blob URL for anything except video (video streaming needs the native
 * `OfflineMedia` scheme handler that lands in the parallel native phase —
 * until then video resolves to `unavailable-offline`, not a broken blob).
 */

import { Directory, Filesystem } from "@capacitor/filesystem";
import { getOfflineDb } from "./db/connection";
import { assetsDao } from "./db/dao/assets-dao";
import { deviceStateDao } from "./db/dao/device-state-dao";
import { getOrCreateOfflineKey, getRawOfflineKeyB64 } from "./crypto/keys";
import { isLeaseValid } from "./lease/lease-state";
import { decryptAssetToBlob, base64ToBytes } from "./crypto/decrypt";
import { CHUNK_SIZE } from "./download/chunked-downloader";
import { isOfflineSupported } from "./platform";
import { Network } from "@/utils/network-plugin";
import { openAsset, closeAsset } from "./native/offline-media";

export type SlideSourceKind = "remote" | "offline-blob" | "offline-stream" | "locked" | "unavailable-offline";

export type LockReason = "LEASE_EXPIRED" | "REVOKED";

export interface SlideSourceResult {
  kind: SlideSourceKind;
  /** Object/blob URL (offline-blob) or the remote signed URL (remote). Absent for locked/unavailable/offline-stream (not implemented yet). */
  url?: string;
  lockReason?: LockReason;
  /** Caller must revoke this via `URL.revokeObjectURL` when done (offline-blob only). */
  revoke?: () => void;
  /**
   * Caller must invoke this on slide change/unmount for `offline-stream`
   * results — it calls the native `OfflineMedia.closeAsset(token)` to
   * zeroize the in-memory decrypt session. Absent for every other kind.
   */
  release?: () => void;
}

export interface ResolveSlideSourceParams {
  userId: string;
  fileId: string;
  slideId: string;
  /** MIME type to tag the decrypted Blob with (viewer-dependent — e.g. "application/pdf", "audio/mpeg"). */
  mimeType: string;
  /** True for VIDEO assets — routed to offline-stream (not yet implemented) instead of offline-blob. */
  isVideo?: boolean;
  /** Remote resolver, e.g. `getPublicUrl(fileId)` — only called for the `remote` path. */
  resolveRemoteUrl: () => Promise<string>;
}

/**
 * Decides how to source a downloadable slide's asset. Callers pass in their
 * existing remote-URL resolver (`getPublicUrl`) so this stays decoupled from
 * `upload_file.ts`.
 */
export async function resolveSlideSource(params: ResolveSlideSourceParams): Promise<SlideSourceResult> {
  const { userId, fileId, slideId, mimeType, isVideo, resolveRemoteUrl } = params;

  const online = (await Network.getStatus()).connected;

  if (online) {
    // Per plan: online always wins, regardless of what's downloaded locally.
    const url = await resolveRemoteUrl();
    return { kind: "remote", url };
  }

  if (!isOfflineSupported()) {
    return { kind: "unavailable-offline" };
  }

  const db = await getOfflineDb();

  const deviceState = await deviceStateDao.get(db, userId);
  if (deviceState?.revoked) {
    return { kind: "locked", lockReason: "REVOKED" };
  }
  if (deviceState && !isLeaseValid(deviceState)) {
    return { kind: "locked", lockReason: "LEASE_EXPIRED" };
  }

  const asset = await assetsDao.get(db, userId, fileId, slideId);
  if (!asset || asset.status !== "DOWNLOADED" || !asset.local_path || !asset.nonce) {
    return { kind: "unavailable-offline" };
  }

  if (isVideo) {
    try {
      const absolutePath = await resolveAbsolutePath(userId, asset.local_path);
      const keyB64 = await getRawOfflineKeyB64(userId);
      const { token, url } = await openAsset({
        path: absolutePath,
        key: keyB64,
        nonce: asset.nonce,
        mimeType: mimeType || "video/mp4",
      });
      return { kind: "offline-stream", url, release: () => void closeAsset(token) };
    } catch (error) {
      console.error(`[offline-resolve] failed to open offline video asset ${fileId}`, error);
      return { kind: "unavailable-offline" };
    }
  }

  try {
    const ciphertext = await readEncryptedFile(userId, asset.local_path);
    const key = await getOrCreateOfflineKey(userId);
    const blob = await decryptAssetToBlob(key, asset.nonce, ciphertext, CHUNK_SIZE, mimeType);
    const url = URL.createObjectURL(blob);
    return { kind: "offline-blob", url, revoke: () => URL.revokeObjectURL(url) };
  } catch (error) {
    console.error(`[offline-resolve] failed to decrypt asset ${fileId}`, error);
    return { kind: "unavailable-offline" };
  }
}

/**
 * Converts the DB's `Directory.Data`-relative `local_path` (e.g.
 * `offline/<userId>/assets/<fileId>.enc`) into an absolute on-disk path the
 * native `OfflineMedia` plugin can `FileManager`/`File`-open directly.
 * Capacitor's `Filesystem.getUri` returns a `file://` URI; the native side
 * expects a plain path, so the scheme is stripped.
 */
async function resolveAbsolutePath(userId: string, localPath: string): Promise<string> {
  void userId; // local_path is already fully relative to Directory.Data.
  const { uri } = await Filesystem.getUri({ path: localPath, directory: Directory.Data });
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

/**
 * Lightweight offline-lock check (device revoked / lease expired) with no
 * file/asset lookup — used as a single up-front gate (mirrors the
 * `RequiresInternetSlide` online-only gate) before attempting to resolve any
 * downloadable slide's source while offline. Returns `null` when unlocked or
 * online/unsupported (nothing to gate).
 */
export async function getOfflineLockReason(userId: string): Promise<LockReason | null> {
  if (!isOfflineSupported()) return null;
  const online = (await Network.getStatus()).connected;
  if (online) return null;
  const db = await getOfflineDb();
  const deviceState = await deviceStateDao.get(db, userId);
  if (deviceState?.revoked) return "REVOKED";
  if (deviceState && !isLeaseValid(deviceState)) return "LEASE_EXPIRED";
  return null;
}

async function readEncryptedFile(userId: string, localPath: string): Promise<Uint8Array> {
  // localPath is stored relative to Directory.Data (see chunked-downloader finalPath()).
  const relative = localPath.startsWith(`offline/${userId}/`) ? localPath : localPath;
  const result = await Filesystem.readFile({ path: relative, directory: Directory.Data });
  const data = typeof result.data === "string" ? result.data : await (result.data as Blob).text();
  return base64ToBytes(data);
}

/** Quick membership check for badges/gates: does this slide have a fully-downloaded local copy? */
export async function hasOfflineCopy(userId: string, slideId: string): Promise<boolean> {
  if (!isOfflineSupported()) return false;
  const db = await getOfflineDb();
  const assets = await assetsDao.listBySlide(db, userId, slideId);
  return assets.length > 0 && assets.every((a) => a.status === "DOWNLOADED");
}
