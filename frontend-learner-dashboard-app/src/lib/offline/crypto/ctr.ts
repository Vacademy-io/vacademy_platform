/**
 * AES-CTR counter math (plan §B3).
 *
 * WebCrypto's AES-CTR takes a 16-byte `counter` block and increments it by
 * one for every 16-byte (128-bit) AES block it processes. For chunked,
 * resumable downloads we encrypt/decrypt in 8 MiB chunks that each start at
 * a known byte offset within the file — to keep the stream random-access
 * (and to resume correctly mid-file) the counter for a chunk must be derived
 * purely from that offset, never from "chunks processed so far".
 *
 * Convention (fixed for this feature, must never change post-ship or every
 * previously-downloaded file becomes undecryptable):
 *   - A random 12-byte nonce is generated once per file and stored in the
 *     `assets.nonce` column (base64).
 *   - The 16-byte counter block = nonce (12 bytes) || 32-bit big-endian block
 *     index (4 bytes), where block index = floor(byteOffset / 16).
 *   - byteOffset MUST be 16-byte-aligned (chunk boundaries are chosen to be
 *     multiples of 16 — 8 MiB is already a multiple of 16, so this holds for
 *     every chunk boundary the downloader uses).
 */

export const AES_BLOCK_SIZE = 16;
export const CTR_NONCE_BYTES = 12;
export const CTR_COUNTER_BYTES = 4;

/** Max blocks a 32-bit counter can address before wrapping: 2^32 * 16 bytes ≈ 64 TiB. Plenty for any single file. */
export const MAX_ADDRESSABLE_BYTES = 2 ** 32 * AES_BLOCK_SIZE;

export function assertBlockAligned(byteOffset: number): void {
  if (!Number.isInteger(byteOffset) || byteOffset < 0) {
    throw new Error(`CTR: byteOffset must be a non-negative integer, got ${byteOffset}`);
  }
  if (byteOffset % AES_BLOCK_SIZE !== 0) {
    throw new Error(
      `CTR: byteOffset ${byteOffset} is not 16-byte-aligned — CTR counters would collide mid-block`
    );
  }
}

/** Generates a fresh random 12-byte nonce for a new file. */
export function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(CTR_NONCE_BYTES));
}

/** byteOffset → AES block index (floor(offset / 16)). Offset must be block-aligned. */
export function byteOffsetToBlockIndex(byteOffset: number): number {
  assertBlockAligned(byteOffset);
  const blockIndex = byteOffset / AES_BLOCK_SIZE;
  if (blockIndex > 2 ** 32 - 1) {
    throw new Error(`CTR: byteOffset ${byteOffset} exceeds max addressable range for this nonce`);
  }
  return blockIndex;
}

/**
 * Builds the 16-byte WebCrypto AES-CTR counter block for a given file nonce
 * and byte offset: nonce (12 bytes) || big-endian block index (4 bytes).
 */
export function buildCounterBlock(nonce: Uint8Array, byteOffset: number): Uint8Array {
  if (nonce.length !== CTR_NONCE_BYTES) {
    throw new Error(`CTR: nonce must be ${CTR_NONCE_BYTES} bytes, got ${nonce.length}`);
  }
  const blockIndex = byteOffsetToBlockIndex(byteOffset);

  const counter = new Uint8Array(AES_BLOCK_SIZE);
  counter.set(nonce, 0);
  // Big-endian 32-bit block index in the last 4 bytes.
  const view = new DataView(counter.buffer, counter.byteOffset, counter.byteLength);
  view.setUint32(CTR_NONCE_BYTES, blockIndex, false);
  return counter;
}

/** WebCrypto's `counter` param for AES-CTR at the given resume offset. `length` is the counter-bit-length (32, per this scheme). */
export function ctrAlgorithmParams(
  nonce: Uint8Array,
  byteOffset: number
): AesCtrParams {
  return {
    name: "AES-CTR",
    counter: buildCounterBlock(nonce, byteOffset) as BufferSource,
    length: 32,
  };
}
