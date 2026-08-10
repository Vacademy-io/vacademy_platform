/**
 * AES-CTR encrypt/decrypt helpers built on the device-local key (keys.ts)
 * and the counter convention in ctr.ts (plan §B3/§B4).
 *
 * Two shapes are used across the feature:
 *  - Small JSON payloads (quiz/question/doc inline JSON): encrypted whole,
 *    base64-encoded, stored in `slide_payloads` — always chunk-index 0.
 *  - Large binary assets (PDF/audio/video): encrypted in fixed-size chunks
 *    keyed by byte offset (chunked-downloader.ts writes them; resolve.ts
 *    reads/decrypts them back for blob playback).
 */

import { ctrAlgorithmParams, generateNonce } from "./ctr";

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encrypts an arbitrary byte range at `byteOffset` within a logical file/blob. */
export async function encryptChunk(
  key: CryptoKey,
  nonce: Uint8Array,
  byteOffset: number,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const ciphertext = await crypto.subtle.encrypt(
    ctrAlgorithmParams(nonce, byteOffset),
    key,
    plaintext as BufferSource
  );
  return new Uint8Array(ciphertext);
}

/** Decrypts a byte range at `byteOffset` (AES-CTR is symmetric: decrypt = encrypt with the same counter). */
export async function decryptChunk(
  key: CryptoKey,
  nonce: Uint8Array,
  byteOffset: number,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    ctrAlgorithmParams(nonce, byteOffset),
    key,
    ciphertext as BufferSource
  );
  return new Uint8Array(plaintext);
}

/** Encrypts a small JSON-serializable payload for `slide_payloads`. Returns base64 ciphertext + base64 nonce. */
export async function encryptJsonPayload(
  key: CryptoKey,
  payload: unknown
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = generateNonce();
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await encryptChunk(key, nonce, 0, plaintext);
  return { ciphertext: bytesToBase64(ciphertext), nonce: bytesToBase64(nonce) };
}

/** Decrypts a `slide_payloads` row back into its original JSON value. */
export async function decryptJsonPayload<T = unknown>(
  key: CryptoKey,
  ciphertextB64: string,
  nonceB64: string
): Promise<T> {
  const nonce = base64ToBytes(nonceB64);
  const ciphertext = base64ToBytes(ciphertextB64);
  const plaintext = await decryptChunk(key, nonce, 0, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** Decrypts a whole encrypted asset (concatenation of chunk-encrypted bytes, each keyed by its own offset) into a plaintext Blob. */
export async function decryptAssetToBlob(
  key: CryptoKey,
  nonceB64: string,
  ciphertext: Uint8Array,
  chunkSize: number,
  mimeType: string
): Promise<Blob> {
  const nonce = base64ToBytes(nonceB64);
  const parts: Uint8Array[] = [];
  for (let offset = 0; offset < ciphertext.length; offset += chunkSize) {
    const slice = ciphertext.subarray(offset, Math.min(offset + chunkSize, ciphertext.length));
    parts.push(await decryptChunk(key, nonce, offset, slice));
  }
  return new Blob(parts as BlobPart[], { type: mimeType });
}
