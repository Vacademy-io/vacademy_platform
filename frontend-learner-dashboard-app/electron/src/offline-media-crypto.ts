import { createCipheriv } from 'crypto';

/**
 * AES-256-CTR counter arithmetic shared by `OfflineMediaPlugin` (Electron main process).
 *
 * REAL contract, as encrypted by the JS downloader (src/lib/offline/crypto/ctr.ts) — this is
 * the single source of truth, do not "improve" this without updating that file too:
 *  - A random **12-byte** nonce is generated once per file and stored in the `assets.nonce`
 *    DB column (base64). It is NOT itself a 16-byte counter block.
 *  - WebCrypto's AES-CTR `counter` param is the 16-byte block `nonce(12) || big-endian
 *    uint32(blockIndex)`, with `length: 32` — i.e. WebCrypto only increments the **last 4
 *    bytes** of the counter block; the 12-byte nonce prefix is fixed for the whole file.
 *    blockIndex = floor(byteOffset / 16).
 *
 * This plugin (and the iOS/Android native equivalents) never see the raw 12-byte nonce —
 * `src/lib/offline/native/offline-media.ts` zero-pads it to a 16-byte value
 * (`nonce(12) || 0x00000000`) before calling `openAsset`, and `key`/`nonce` below are always
 * that padded 16-byte form. Treating that padded form as a plain 128-bit big-endian integer and
 * adding `blockIndex` to it (this file's `addCounter`) is mathematically identical to
 * WebCrypto's "only the last 4 bytes increment" rule for any realistic file size: blockIndex
 * never reaches 2^32 (that would require a ~64 TiB file), so the addition can never carry into
 * the fixed 12-byte nonce prefix. Verified byte-for-byte against real WebCrypto output,
 * including a non-16-byte-aligned offset (an HTTP Range request during video seeking need not
 * land on a block boundary even though the downloader's own chunk writes always do), by
 * scripts/offline-media-test-vectors.ts — see docs/offline-media-plugin.md for the vector table
 * and how to re-run it.
 *
 *  - keystream_i = AES-256-ECB-encrypt(key, paddedNonce16_as_uint128 + i), block index i = floor(offset / 16).
 *  - plaintext = ciphertext XOR keystream, discarding the first (offset mod 16) bytes of the
 *    first keystream block when `offset` isn't itself block-aligned.
 *
 * Node's `crypto.createDecipheriv('aes-256-ctr', key, counterBlock)` already implements exactly
 * this counter-increment convention when given a starting counter block, so we don't need to
 * hand-roll AES-ECB like the iOS/Android implementations do — we just need to compute the
 * correct starting counter block for an arbitrary byte offset, then let Node's CTR decipher
 * consume ciphertext from that offset onward. This is the single source of truth for the
 * counter math on Electron; the Node test-vector script (scripts/offline-media-test-vectors.ts)
 * imports this exact function rather than re-implementing it.
 */

/**
 * Adds `blockIndex` to the 16-byte `nonce`, treating it as a big-endian 128-bit integer, via
 * plain byte-array carry addition — deliberately avoids BigInt (electron/tsconfig.json targets
 * ES2017, which doesn't support BigInt literal syntax / lib types) and mirrors the exact
 * carry-loop approach used by the iOS (`OfflineMediaCrypto.swift`) and Android
 * (`OfflineMediaCrypto.java`) implementations, so all three platforms are visibly doing the same
 * thing rather than three different-looking-but-hopefully-equivalent algorithms.
 */
export function addCounter(nonce: Buffer, blockIndex: number): Buffer {
  if (nonce.length !== 16) {
    throw new Error(`nonce must be 16 bytes, got ${nonce.length}`);
  }
  const counter = Buffer.from(nonce);
  // blockIndex fits comfortably in a JS safe integer (< 2^32 for any realistic file size, see
  // module doc comment), so add it as a plain number, byte by byte, from the least-significant
  // byte (index 15) toward the most-significant (index 0), carrying overflow leftward.
  let carry = blockIndex;
  for (let i = 15; i >= 0 && carry > 0; i--) {
    const sum = counter[i] + (carry & 0xff);
    counter[i] = sum & 0xff;
    carry = Math.floor(carry / 256) + (sum > 0xff ? 1 : 0);
  }
  return counter;
}

/**
 * Decrypts `ciphertext`, the byte range `[fileOffset, fileOffset + ciphertext.length)` of an
 * AES-256-CTR-encrypted file, given the file's 32-byte key and 16-byte nonce.
 *
 * Implementation note: rather than hand-rolling AES-ECB block-by-block (as the iOS/Android
 * native code must, since neither CommonCrypto nor javax.crypto.Cipher's stock CTR mode lets
 * you both seek AND stream cleanly the same way), we exploit the fact that Node's
 * `aes-256-ctr` Decipher already increments its counter internally per 16-byte block starting
 * from whatever IV/counter block you hand it — so seeking is just "compute the right starting
 * counter block for this offset, discard the first (offset % 16) bytes of output".
 */
export function decryptRange(ciphertext: Buffer, key: Buffer, nonce: Buffer, fileOffset: number): Buffer {
  if (key.length !== 32) throw new Error(`key must be 32 bytes, got ${key.length}`);
  if (nonce.length !== 16) throw new Error(`nonce must be 16 bytes, got ${nonce.length}`);
  if (ciphertext.length === 0) return Buffer.alloc(0);

  const blockIndex = Math.floor(fileOffset / 16);
  const subOffset = fileOffset % 16;
  const counterBlock = addCounter(nonce, blockIndex);

  const decipher = createCipheriv('aes-256-ctr', key, counterBlock);
  // aes-256-ctr is symmetric (createCipheriv/createDecipheriv both just XOR the same
  // keystream); using createCipheriv for decrypt-of-ciphertext is intentional and correct.

  // If fileOffset isn't 16-byte-aligned, pad the front of the input with `subOffset` dummy
  // zero bytes so the keystream consumed for those bytes is discarded, keeping the real
  // ciphertext bytes aligned to the correct keystream position.
  const padded = subOffset === 0 ? ciphertext : Buffer.concat([Buffer.alloc(subOffset), ciphertext]);
  const plaintextPadded = Buffer.concat([decipher.update(padded), decipher.final()]);
  return subOffset === 0 ? plaintextPadded : plaintextPadded.subarray(subOffset);
}
