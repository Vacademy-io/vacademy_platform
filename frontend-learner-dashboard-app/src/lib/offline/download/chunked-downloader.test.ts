import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, nextChunkWindow, verifyChecksum } from "./chunked-downloader";

describe("nextChunkWindow (resume math)", () => {
  it("starts at 0 for a fresh file", () => {
    expect(nextChunkWindow(0, 100)).toEqual({ start: 0, end: 100 });
  });

  it("windows at CHUNK_SIZE for a file larger than one chunk", () => {
    const size = CHUNK_SIZE * 2 + 100;
    expect(nextChunkWindow(0, size)).toEqual({ start: 0, end: CHUNK_SIZE });
  });

  it("resumes from the exact committed byte offset (.part file size)", () => {
    const size = CHUNK_SIZE * 3;
    const alreadyDownloaded = CHUNK_SIZE * 2;
    expect(nextChunkWindow(alreadyDownloaded, size)).toEqual({
      start: CHUNK_SIZE * 2,
      end: CHUNK_SIZE * 3,
    });
  });

  it("clamps the final window to the file size (no over-read)", () => {
    const size = CHUNK_SIZE + 500;
    expect(nextChunkWindow(CHUNK_SIZE, size)).toEqual({ start: CHUNK_SIZE, end: CHUNK_SIZE + 500 });
  });

  it("returns null once the file is fully downloaded", () => {
    expect(nextChunkWindow(1000, 1000)).toBeNull();
  });

  it("returns null if somehow already past the file size (defensive)", () => {
    expect(nextChunkWindow(1200, 1000)).toBeNull();
  });

  it("walking the windows from 0 to completion covers every byte exactly once, in order", () => {
    const size = CHUNK_SIZE * 2 + 12345;
    let offset = 0;
    const windows: { start: number; end: number }[] = [];
    let window = nextChunkWindow(offset, size);
    while (window) {
      windows.push(window);
      offset = window.end;
      window = nextChunkWindow(offset, size);
    }
    expect(windows[0].start).toBe(0);
    expect(windows[windows.length - 1].end).toBe(size);
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].start).toBe(windows[i - 1].end);
    }
  });
});

describe("verifyChecksum", () => {
  it("passes (no-op) for the S3_ETAG checksum type shipped today — opaque, not client-reproducible", () => {
    expect(verifyChecksum("S3_ETAG", "some-etag-value", "deadbeef")).toBe(true);
  });

  it("passes when no expected checksum is present at all", () => {
    expect(verifyChecksum(null, null, "deadbeef")).toBe(true);
  });

  it("verifies a matching SHA256 checksum", () => {
    expect(verifyChecksum("SHA256", "DEADBEEF", "deadbeef")).toBe(true);
  });

  it("fails a mismatched SHA256 checksum", () => {
    expect(verifyChecksum("SHA256", "abc123", "deadbeef")).toBe(false);
  });
});
