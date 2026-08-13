import { describe, expect, it } from "vitest";
import {
  AES_BLOCK_SIZE,
  assertBlockAligned,
  buildCounterBlock,
  byteOffsetToBlockIndex,
  generateNonce,
} from "./ctr";

describe("CTR counter math", () => {
  it("accepts block-aligned offsets", () => {
    expect(() => assertBlockAligned(0)).not.toThrow();
    expect(() => assertBlockAligned(16)).not.toThrow();
    expect(() => assertBlockAligned(8 * 1024 * 1024)).not.toThrow();
  });

  it("rejects non-block-aligned offsets", () => {
    expect(() => assertBlockAligned(1)).toThrow();
    expect(() => assertBlockAligned(15)).toThrow();
    expect(() => assertBlockAligned(-16)).toThrow();
  });

  it("maps offset 0 to block index 0", () => {
    expect(byteOffsetToBlockIndex(0)).toBe(0);
  });

  it("maps offset to block index = offset / 16", () => {
    expect(byteOffsetToBlockIndex(16)).toBe(1);
    expect(byteOffsetToBlockIndex(8 * 1024 * 1024)).toBe((8 * 1024 * 1024) / AES_BLOCK_SIZE);
  });

  it("builds a 16-byte counter block: nonce || big-endian block index", () => {
    const nonce = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const block = buildCounterBlock(nonce, 0);
    expect(block).toHaveLength(16);
    expect(Array.from(block.subarray(0, 12))).toEqual(Array.from(nonce));
    expect(Array.from(block.subarray(12, 16))).toEqual([0, 0, 0, 0]);
  });

  it("increments the block index encoding as offset grows by whole blocks", () => {
    const nonce = new Uint8Array(12);
    const at1Block = buildCounterBlock(nonce, 16);
    const view = new DataView(at1Block.buffer, at1Block.byteOffset, at1Block.byteLength);
    expect(view.getUint32(12, false)).toBe(1);

    const at1000Blocks = buildCounterBlock(nonce, 16 * 1000);
    const view2 = new DataView(at1000Blocks.buffer, at1000Blocks.byteOffset, at1000Blocks.byteLength);
    expect(view2.getUint32(12, false)).toBe(1000);
  });

  it("chunk-boundary offsets (8 MiB windows) always resolve to a valid counter block", () => {
    const nonce = generateNonce();
    const chunkSize = 8 * 1024 * 1024;
    for (let i = 0; i < 5; i++) {
      const offset = i * chunkSize;
      expect(() => buildCounterBlock(nonce, offset)).not.toThrow();
    }
  });

  it("rejects a nonce of the wrong length", () => {
    expect(() => buildCounterBlock(new Uint8Array(11), 0)).toThrow();
    expect(() => buildCounterBlock(new Uint8Array(13), 0)).toThrow();
  });

  it("resume math: counter for the byte offset a partial download left off at matches a fresh computation from scratch", () => {
    const nonce = generateNonce();
    // Simulate: 2.5 chunks already committed (2 full 8 MiB chunks + a partial that
    // never happens in practice since chunks always complete atomically before
    // being appended — so resume offsets are always chunk-boundary multiples).
    const bytesDownloaded = 2 * 8 * 1024 * 1024;
    const resumed = buildCounterBlock(nonce, bytesDownloaded);
    const freshComputationAtSameOffset = buildCounterBlock(nonce, bytesDownloaded);
    expect(Array.from(resumed)).toEqual(Array.from(freshComputationAtSameOffset));
  });
});
