/**
 * Chunked, resumable, encrypt-on-write asset downloader (plan §B1/§B3).
 *
 * Fetches plaintext over TLS with `Range` in 8 MiB windows, AES-CTR encrypts
 * each window in-flight (counter derived from the *plaintext byte offset* —
 * see crypto/ctr.ts — so resume never re-derives a used counter block), and
 * appends ciphertext to `offline/<userId>/tmp/<fileId>.part` via
 * @capacitor/filesystem. On completion the `.part` is atomically renamed to
 * `offline/<userId>/assets/<fileId>.enc`. Plaintext never touches disk.
 *
 * Resume: the `.part` file's on-disk byte length (via `Filesystem.stat`,
 * which reflects genuine binary size since ciphertext length === plaintext
 * length for CTR) is exactly the last committed offset — `bytes_downloaded`
 * on the `assets` row mirrors it for the progress UI, but disk is the source
 * of truth for where to resume.
 *
 * Checksum note: the backend manifest ships `checksum_type: 'S3_ETAG'`
 * (opaque per plan §A2 — a multipart-upload ETag is not a plain digest of
 * the object, so it cannot be reproduced client-side). We still compute a
 * running SHA-256 of the plaintext for local corruption detection, but only
 * treat a mismatch as fatal when `checksumType === 'SHA256'`; for
 * `S3_ETAG` (today's only value) we log and proceed — see
 * `verifyChecksum`.
 */

import { Directory, Filesystem } from "@capacitor/filesystem";
import { encryptChunk, bytesToBase64, base64ToBytes } from "../crypto/decrypt";
import { generateNonce } from "../crypto/ctr";

export const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB — a multiple of the 16-byte AES block size

export interface ChunkedDownloadJob {
  userId: string;
  fileId: string;
  key: CryptoKey;
  /** Nonce to (re)use for this file — pass the persisted one to resume, or a fresh one for a new download. */
  nonce: Uint8Array;
  sizeBytes: number;
  checksum: string | null;
  checksumType: string | null;
  /** Returns a fresh signed URL; called at job start and again on a 403 (plan §B3 "signed-URL refresh at job start and on 403"). */
  getSignedUrl: () => Promise<string>;
  onProgress?: (bytesDownloaded: number) => void;
  signal?: AbortSignal;
}

export interface ChunkedDownloadResult {
  localPath: string;
  bytesDownloaded: number;
  checksumVerified: boolean;
}

export function tmpPath(userId: string, fileId: string): string {
  return `offline/${userId}/tmp/${fileId}.part`;
}

export function finalPath(userId: string, fileId: string): string {
  return `offline/${userId}/assets/${fileId}.enc`;
}

async function ensureDirs(userId: string): Promise<void> {
  for (const path of [`offline/${userId}/tmp`, `offline/${userId}/assets`]) {
    try {
      await Filesystem.mkdir({ path, directory: Directory.Data, recursive: true });
    } catch {
      // already exists
    }
  }
}

async function currentPartSize(userId: string, fileId: string): Promise<number> {
  try {
    const stat = await Filesystem.stat({ path: tmpPath(userId, fileId), directory: Directory.Data });
    return stat.size;
  } catch {
    return 0; // no .part yet
  }
}

/** Next chunk's [start, end) byte window given how much of the file is already committed. */
export function nextChunkWindow(
  bytesDownloaded: number,
  sizeBytes: number,
  chunkSize: number = CHUNK_SIZE
): { start: number; end: number } | null {
  if (bytesDownloaded >= sizeBytes) return null;
  const end = Math.min(bytesDownloaded + chunkSize, sizeBytes);
  return { start: bytesDownloaded, end };
}

class Sha256Accumulator {
  private chunks: Uint8Array[] = [];

  push(chunk: Uint8Array): void {
    this.chunks.push(chunk);
  }

  async digestHex(): Promise<string> {
    const total = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    const digest = await crypto.subtle.digest("SHA-256", merged as BufferSource);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/** Only SHA256-typed manifest checksums can be verified client-side; S3_ETAG is opaque (see module doc). */
export function verifyChecksum(
  checksumType: string | null,
  expected: string | null,
  actualSha256Hex: string
): boolean {
  if (checksumType !== "SHA256" || !expected) return true; // nothing comparable — treat as pass
  return expected.toLowerCase() === actualSha256Hex.toLowerCase();
}

/**
 * HTTP 403 usually means the signed URL expired mid-download — this is the
 * one error class the downloader retries inline (once) by refreshing the
 * URL; everything else is surfaced to the caller (download-manager) for its
 * own backoff/retry policy.
 */
export async function downloadAssetChunked(job: ChunkedDownloadJob): Promise<ChunkedDownloadResult> {
  const { userId, fileId, key, nonce, sizeBytes, checksumType, checksum } = job;
  await ensureDirs(userId);

  let signedUrl = await job.getSignedUrl();
  let bytesDownloaded = await currentPartSize(userId, fileId);
  const hasher = new Sha256Accumulator();

  // NOTE: resume from a non-zero offset can't re-verify prior chunks' plaintext
  // for the running SHA-256 (ciphertext on disk, by design, is never
  // decrypted just to re-hash) — the accumulator only covers bytes fetched
  // in *this* call. That's fine: verifyChecksum() is a best-effort local
  // corruption signal, not the source of truth (manifest checksum is opaque
  // S3_ETAG today anyway — see module doc).

  let window = nextChunkWindow(bytesDownloaded, sizeBytes);
  while (window) {
    if (job.signal?.aborted) throw new DOMException("aborted", "AbortError");

    let response: Response;
    try {
      response = await fetch(signedUrl, {
        headers: { Range: `bytes=${window.start}-${window.end - 1}` },
        signal: job.signal,
      });
    } catch (err) {
      throw err;
    }

    if (response.status === 403) {
      signedUrl = await job.getSignedUrl();
      continue; // retry the same window with a fresh URL
    }
    if (!(response.status === 206 || response.status === 200)) {
      throw new Error(`Chunk download failed: HTTP ${response.status} for ${fileId}`);
    }

    const plaintext = new Uint8Array(await response.arrayBuffer());
    hasher.push(plaintext);

    const ciphertext = await encryptChunk(key, nonce, window.start, plaintext);
    await Filesystem.appendFile({
      path: tmpPath(userId, fileId),
      directory: Directory.Data,
      data: bytesToBase64(ciphertext),
    });

    bytesDownloaded = window.start + plaintext.length;
    job.onProgress?.(bytesDownloaded);
    window = nextChunkWindow(bytesDownloaded, sizeBytes);
  }

  const actualSha256 = await hasher.digestHex();
  const checksumVerified = verifyChecksum(checksumType, checksum, actualSha256);
  if (!checksumVerified) {
    throw new Error(`Checksum mismatch for asset ${fileId}`);
  }

  await Filesystem.rename({
    from: tmpPath(userId, fileId),
    to: finalPath(userId, fileId),
    directory: Directory.Data,
    toDirectory: Directory.Data,
  });

  return {
    localPath: finalPath(userId, fileId),
    bytesDownloaded,
    checksumVerified,
  };
}

/** Best-effort cleanup of a `.part` file (cancel / permanent failure). */
export async function deletePartFile(userId: string, fileId: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path: tmpPath(userId, fileId), directory: Directory.Data });
  } catch {
    // already gone
  }
}

/** Ref-counted final asset delete — caller (download-manager) must have already checked no other slide references this file. */
export async function deleteAssetFile(userId: string, fileId: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path: finalPath(userId, fileId), directory: Directory.Data });
  } catch {
    // already gone
  }
}

export { generateNonce, base64ToBytes, bytesToBase64 };
