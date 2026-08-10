import { statfs } from 'fs';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { app, protocol } from 'electron';

import { decryptRange } from './offline-media-crypto';

const statfsAsync = promisify(statfs);

/** Read/decrypt in 256 KiB chunks (a multiple of the 16-byte AES block size). */
const CHUNK_SIZE = 256 * 1024;

interface OfflineMediaSession {
  path: string;
  key: Buffer;
  nonce: Buffer;
  mimeType: string;
}

const sessions = new Map<string, OfflineMediaSession>();

function guessMimeType(path: string, override?: string): string {
  if (override) return override;
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
}

/** Parses a single-range "bytes=start-end" / "bytes=start-" header per RFC 7233. */
function parseRange(header: string | null, totalSize: number): { start: number; end: number } | null {
  if (!header || !header.startsWith('bytes=')) return null;
  const spec = header.slice('bytes='.length).split(',')[0]?.trim() ?? '';
  const [startStr, endStr] = spec.split('-');

  if (startStr === '' && endStr) {
    const suffixLength = Number(endStr);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0 || totalSize === 0) return null;
    const start = suffixLength >= totalSize ? 0 : totalSize - suffixLength;
    return { start, end: totalSize - 1 };
  }

  const start = Number(startStr);
  if (!Number.isFinite(start)) return null;
  if (endStr === '' || endStr === undefined) {
    if (totalSize === 0) return null;
    return { start, end: totalSize - 1 };
  }
  const end = Number(endStr);
  if (!Number.isFinite(end)) return null;
  const clampedEnd = totalSize > 0 ? Math.min(end, totalSize - 1) : end;
  if (start > clampedEnd) return null;
  return { start, end: clampedEnd };
}

let schemeRegistered = false;

/**
 * Registers the `offline-media://` custom protocol handler once per app process. Serves
 * `offline-media://<token>/stream` by decrypting the on-disk ciphertext for an open
 * `openAsset()` session, on the fly, per requested byte range — the Electron half of the
 * "video always streams through OfflineMedia, never via a raw file:// src" playback strategy
 * (the file on disk is ciphertext; serving it directly would leak plaintext / play garbage).
 *
 * Uses Electron's `protocol.handle` (available since Electron 25; this app is on Electron
 * ^26.2.2 — see electron/package.json). The scheme itself must be registered as privileged via
 * `protocol.registerSchemesAsPrivileged` *before* `app.whenReady()` resolves — that call lives
 * in electron/src/index.ts (module top-level), not here, since privileged-scheme registration
 * cannot happen after the app is ready.
 */
function registerOfflineMediaScheme(): void {
  if (schemeRegistered) return;
  schemeRegistered = true;

  protocol.handle('offline-media', async (request) => {
    const url = new URL(request.url);
    const token = url.hostname;
    const session = sessions.get(token);
    if (!session) {
      return new Response('Unknown or closed OfflineMedia token', { status: 404 });
    }

    let totalSize: number;
    try {
      const { statSync } = await import('fs');
      totalSize = statSync(session.path).size;
    } catch {
      return new Response(`File not found: ${session.path}`, { status: 404 });
    }

    const rangeHeader = request.headers.get('Range');
    const parsedRange = parseRange(rangeHeader, totalSize);
    const isPartial = parsedRange !== null;
    const start = parsedRange?.start ?? 0;
    const end = parsedRange?.end ?? (totalSize > 0 ? totalSize - 1 : 0);
    const contentLength = totalSize === 0 ? 0 : end - start + 1;

    const headers: Record<string, string> = {
      'Content-Type': session.mimeType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(contentLength),
      'Cache-Control': 'no-store',
    };
    if (isPartial) {
      headers['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
    }

    if (contentLength === 0) {
      return new Response(null, { status: isPartial ? 206 : 200, headers });
    }

    const { createReadStream } = await import('fs');
    const nodeStream = createReadStream(session.path, { start, end, highWaterMark: CHUNK_SIZE });

    let offset = start;
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => {
          try {
            const plaintext = decryptRange(chunk, session.key, session.nonce, offset);
            offset += chunk.length;
            controller.enqueue(new Uint8Array(plaintext));
          } catch (err) {
            controller.error(err);
            nodeStream.destroy();
          }
        });
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new Response(webStream, { status: isPartial ? 206 : 200, headers });
  });
}

/**
 * Main-process implementation of the `OfflineMedia` Capacitor plugin for Electron, following
 * this repo's `@capacitor-community/electron` local-plugin convention: exported from
 * `electron/src/rt/electron-plugins.js`, instantiated once by `setupCapacitorElectronPlugins()`
 * (called from `ElectronCapacitorApp.init()` in electron/src/setup.ts, i.e. after
 * `app.whenReady()`), with each public method auto-bridged to `ipcMain.handle('OfflineMedia-<method>', ...)`
 * and exposed to the renderer as `window.CapacitorCustomPlatform.plugins.OfflineMedia.<method>()`
 * by electron/src/rt/electron-rt.ts's preload bridge. src/lib/offline/native/offline-media.ts
 * picks this up automatically via `registerPlugin('OfflineMedia', { electron: () => ... })`.
 */
export class OfflineMedia {
  constructor() {
    registerOfflineMediaScheme();
  }

  async getFreeDiskSpace(): Promise<{ bytes: number }> {
    try {
      const stats = await statfsAsync(app.getPath('userData'));
      // Node's Stats (bavail = free blocks available to unprivileged users) * block size.
      const bytes = stats.bavail * stats.bsize;
      return { bytes };
    } catch (err) {
      console.error('[OfflineMedia] getFreeDiskSpace failed:', err);
      return { bytes: 0 };
    }
  }

  async openAsset(params: { path: string; keyB64: string; nonceB64: string; mimeType?: string }): Promise<{
    token: string;
    url: string;
  }> {
    const { path, keyB64, nonceB64, mimeType } = params ?? ({} as typeof params);
    if (!path) throw new Error('Missing required parameter: path');

    const key = Buffer.from(keyB64 ?? '', 'base64');
    const nonce = Buffer.from(nonceB64 ?? '', 'base64');
    if (key.length !== 32) throw new Error(`keyB64 must decode to 32 bytes (AES-256), got ${key.length}`);
    if (nonce.length !== 16) throw new Error(`nonceB64 must decode to 16 bytes, got ${nonce.length}`);

    const { existsSync } = await import('fs');
    if (!existsSync(path)) throw new Error(`File does not exist at path: ${path}`);

    const token = randomUUID();
    sessions.set(token, { path, key, nonce, mimeType: guessMimeType(path, mimeType) });
    return { token, url: `offline-media://${token}/stream` };
  }

  async closeAsset(params: { token: string }): Promise<void> {
    const { token } = params ?? ({} as typeof params);
    const session = sessions.get(token);
    if (session) {
      session.key.fill(0);
      session.nonce.fill(0);
      sessions.delete(token);
    }
  }
}
