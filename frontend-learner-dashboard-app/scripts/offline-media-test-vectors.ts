#!/usr/bin/env node
/**
 * Generates AES-256-CTR test vectors using the REAL contract the JS downloader uses
 * (src/lib/offline/crypto/ctr.ts): a 12-byte random nonce per file, WebCrypto AES-CTR with
 * `counter = nonce(12) || big-endian-uint32(blockIndex)`, `length: 32` (i.e. only the last 4
 * bytes of the 16-byte counter block increment; the 12-byte nonce prefix never changes for any
 * realistic file size).
 *
 * Encrypts with Node's `crypto.webcrypto.subtle` (the actual WebCrypto implementation, so this
 * is ground truth — not a reimplementation) and then decrypts arbitrary byte ranges — including
 * a non-16-byte-aligned offset, which real HTTP `Range` requests during video seeking will
 * produce even though the downloader's own chunk boundaries are always 16-aligned — using the
 * exact `decryptRange`/`addCounter` functions from electron/src/offline-media-crypto.ts (the
 * canonical implementation the Electron main-process plugin actually runs), imported directly
 * via ts-node so there is no risk of this script's logic drifting from the real code.
 *
 * Run: node_modules/.bin/ts-node-transpile-only scripts/offline-media-test-vectors.ts
 */

import { webcrypto } from 'node:crypto';
import { decryptRange } from '../electron/src/offline-media-crypto';

const { subtle } = webcrypto;

/** Builds the 16-byte counter block: nonce(12) || big-endian uint32(blockIndex). */
function buildCounterBlock(nonce12, blockIndex) {
  const block = Buffer.alloc(16);
  nonce12.copy(block, 0);
  block.writeUInt32BE(blockIndex >>> 0, 12);
  return block;
}

async function encryptWithWebCrypto(key, nonce12, plaintext) {
  const cryptoKey = await subtle.importKey('raw', key, { name: 'AES-CTR' }, false, ['encrypt']);
  const counter = buildCounterBlock(nonce12, 0);
  const ciphertext = await subtle.encrypt({ name: 'AES-CTR', counter, length: 32 }, cryptoKey, plaintext);
  return Buffer.from(ciphertext);
}

async function main() {
  const vectors = [];

  // Vector 1: 3 aligned blocks (48 bytes), decrypt full range from offset 0.
  {
    const key = webcrypto.getRandomValues(Buffer.alloc(32));
    const nonce = webcrypto.getRandomValues(Buffer.alloc(12));
    const plaintext = Buffer.from('AAAAAAAAAAAAAAAA' + 'BBBBBBBBBBBBBBBB' + 'CCCCCCCCCCCCCCCC', 'utf8'); // 48 bytes
    const ciphertext = await encryptWithWebCrypto(key, nonce, plaintext);
    // The 16-byte counter block our native/electron code expects: nonce(12) || 4 zero bytes,
    // exactly as src/lib/offline/native/offline-media.ts must construct before calling
    // openAsset() — native code only ever sees this padded 16-byte form, never the raw 12-byte
    // DB value.
    const paddedNonce16 = Buffer.concat([nonce, Buffer.alloc(4)]);
    const decrypted = decryptRange(ciphertext, key, paddedNonce16, 0);
    vectors.push({
      name: 'aligned-full-range (offset 0, 48 bytes / 3 blocks)',
      keyHex: key.toString('hex'),
      nonce12Hex: nonce.toString('hex'),
      paddedNonce16Hex: paddedNonce16.toString('hex'),
      plaintextHex: plaintext.toString('hex'),
      ciphertextHex: ciphertext.toString('hex'),
      offset: 0,
      expectedPlaintextSliceHex: plaintext.toString('hex'),
      actualPlaintextSliceHex: decrypted.toString('hex'),
      pass: decrypted.equals(plaintext),
    });
  }

  // Vector 2: aligned mid-file offset (block-aligned, offset 32 = start of block index 2).
  {
    const key = webcrypto.getRandomValues(Buffer.alloc(32));
    const nonce = webcrypto.getRandomValues(Buffer.alloc(12));
    const plaintext = Buffer.from('1111111111111111' + '2222222222222222' + '3333333333333333', 'utf8'); // 48 bytes
    const ciphertext = await encryptWithWebCrypto(key, nonce, plaintext);
    const paddedNonce16 = Buffer.concat([nonce, Buffer.alloc(4)]);
    const offset = 32; // block-aligned (block index 2)
    const ciphertextSlice = ciphertext.subarray(offset);
    const decrypted = decryptRange(ciphertextSlice, key, paddedNonce16, offset);
    const expected = plaintext.subarray(offset);
    vectors.push({
      name: 'aligned-mid-file (offset 32, block index 2)',
      keyHex: key.toString('hex'),
      nonce12Hex: nonce.toString('hex'),
      paddedNonce16Hex: paddedNonce16.toString('hex'),
      plaintextHex: plaintext.toString('hex'),
      ciphertextHex: ciphertext.toString('hex'),
      offset,
      expectedPlaintextSliceHex: expected.toString('hex'),
      actualPlaintextSliceHex: decrypted.toString('hex'),
      pass: decrypted.equals(expected),
    });
  }

  // Vector 3: NON-16-byte-aligned offset (simulates an HTTP Range request mid-block during
  // video seeking — the downloader itself never writes at a sub-block offset, but playback
  // Range requests are arbitrary, so native decrypt MUST handle this).
  {
    const key = webcrypto.getRandomValues(Buffer.alloc(32));
    const nonce = webcrypto.getRandomValues(Buffer.alloc(12));
    const plaintext = Buffer.from('0123456789ABCDEF' + 'GHIJKLMNOPQRSTUV' + 'WXYZabcdefghijkl', 'utf8'); // 48 bytes
    const ciphertext = await encryptWithWebCrypto(key, nonce, plaintext);
    const paddedNonce16 = Buffer.concat([nonce, Buffer.alloc(4)]);
    const offset = 20; // block index 1 (floor(20/16)=1), sub-block offset 4
    const ciphertextSlice = ciphertext.subarray(offset);
    const decrypted = decryptRange(ciphertextSlice, key, paddedNonce16, offset);
    const expected = plaintext.subarray(offset);
    vectors.push({
      name: 'non-aligned (offset 20 = block 1 + 4 bytes, HTTP Range seek case)',
      keyHex: key.toString('hex'),
      nonce12Hex: nonce.toString('hex'),
      paddedNonce16Hex: paddedNonce16.toString('hex'),
      plaintextHex: plaintext.toString('hex'),
      ciphertextHex: ciphertext.toString('hex'),
      offset,
      expectedPlaintextSliceHex: expected.toString('hex'),
      actualPlaintextSliceHex: decrypted.toString('hex'),
      pass: decrypted.equals(expected),
    });
  }

  const allPass = vectors.every((v) => v.pass);
  console.log(JSON.stringify(vectors, null, 2));
  console.log(`\n${allPass ? 'ALL VECTORS PASS' : 'FAILURE: at least one vector mismatched'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
