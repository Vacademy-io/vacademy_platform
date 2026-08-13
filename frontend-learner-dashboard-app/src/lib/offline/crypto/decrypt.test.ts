import { describe, expect, it } from "vitest";
import { generateNonce } from "./ctr";
import {
  decryptAssetToBlob,
  decryptChunk,
  decryptJsonPayload,
  encryptChunk,
  encryptJsonPayload,
} from "./decrypt";

async function makeKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-CTR" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

describe("encrypt/decrypt round trip", () => {
  it("round-trips a single chunk", async () => {
    const key = await makeKey();
    const nonce = generateNonce();
    const plaintext = new TextEncoder().encode("hello offline world");

    const ciphertext = await encryptChunk(key, nonce, 0, plaintext);
    expect(ciphertext).not.toEqual(plaintext);

    const decrypted = await decryptChunk(key, nonce, 0, ciphertext);
    expect(new TextDecoder().decode(decrypted)).toBe("hello offline world");
  });

  it("round-trips a JSON payload (slide_payloads use case)", async () => {
    const key = await makeKey();
    const payload = { questions: [{ id: "q1", text: "2+2?" }], quizType: "MCQ" };

    const { ciphertext, nonce } = await encryptJsonPayload(key, payload);
    const decrypted = await decryptJsonPayload<typeof payload>(key, ciphertext, nonce);

    expect(decrypted).toEqual(payload);
  });

  it("round-trips a multi-chunk asset (simulating a downloaded file split at chunk boundaries)", async () => {
    const key = await makeKey();
    const nonce = generateNonce();
    const chunkSize = 32; // small chunk size for a fast test; still block-aligned (multiple of 16)
    const totalSize = chunkSize * 3 + 16; // 3 full chunks + one partial-but-block-aligned tail

    const plaintext = crypto.getRandomValues(new Uint8Array(totalSize));

    const ciphertextParts: Uint8Array[] = [];
    for (let offset = 0; offset < plaintext.length; offset += chunkSize) {
      const slice = plaintext.subarray(offset, Math.min(offset + chunkSize, plaintext.length));
      ciphertextParts.push(await encryptChunk(key, nonce, offset, slice));
    }
    const merged = new Uint8Array(totalSize);
    let cursor = 0;
    for (const part of ciphertextParts) {
      merged.set(part, cursor);
      cursor += part.length;
    }

    const blob = await decryptAssetToBlob(key, bytesToB64(nonce), merged, chunkSize, "application/octet-stream");
    const decryptedBuffer = new Uint8Array(await blob.arrayBuffer());

    expect(Array.from(decryptedBuffer)).toEqual(Array.from(plaintext));
  });

  it("decrypting with the wrong nonce produces garbage, not the original plaintext", async () => {
    const key = await makeKey();
    const nonce = generateNonce();
    const wrongNonce = generateNonce();
    const plaintext = new TextEncoder().encode("sensitive offline content");

    const ciphertext = await encryptChunk(key, nonce, 0, plaintext);
    const decrypted = await decryptChunk(key, wrongNonce, 0, ciphertext);

    expect(new TextDecoder().decode(decrypted)).not.toBe("sensitive offline content");
  });
});

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
