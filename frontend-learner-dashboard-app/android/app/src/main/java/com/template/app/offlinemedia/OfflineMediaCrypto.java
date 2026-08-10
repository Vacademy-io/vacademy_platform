package io.vacademy.student.app.offlinemedia;

import java.math.BigInteger;
import java.security.GeneralSecurityException;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/**
 * Streaming AES-256-CTR decryption matching the JS downloader's WebCrypto AES-CTR usage
 * (src/lib/offline/crypto/ctr.ts) and the iOS implementation
 * (ios/App/App/OfflineMediaCrypto.swift) byte-for-byte.
 *
 * REAL contract (do not change without updating src/lib/offline/crypto/ctr.ts too):
 *  - The JS downloader stores a random **12-byte** nonce per file (`assets.nonce`). WebCrypto's
 *    AES-CTR counter block is `nonce(12) || big-endian-uint32(blockIndex)`, `length: 32` — only
 *    the last 4 bytes of the 16-byte counter block increment; the nonce prefix never changes.
 *  - This plugin never sees that raw 12-byte value: `src/lib/offline/native/offline-media.ts`
 *    zero-pads it to 16 bytes (`nonce(12) || 0x00000000`) before calling `openAsset`, so `nonce`
 *    below is always that padded 16-byte form.
 *  - Treating the padded 16-byte nonce as a big-endian 128-bit integer and adding `blockIndex`
 *    to it (see {@link #addCounter}) is mathematically identical to WebCrypto's "only the last
 *    4 bytes increment" rule for any realistic file size — blockIndex never reaches 2^32 (a
 *    ~64 TiB file), so the addition can never carry into the fixed 12-byte prefix. Verified
 *    against real WebCrypto output, including non-16-byte-aligned offsets, by
 *    scripts/offline-media-test-vectors.ts (see docs/offline-media-plugin.md).
 *  - keystream_i = AES-256-ECB-encrypt(key, paddedNonce16_as_uint128 + i), block index i = floor(fileOffset / 16).
 *  - plaintext = ciphertext XOR keystream, discarding the first (fileOffset mod 16) bytes of
 *    the first keystream block when fileOffset is not itself block-aligned.
 */
final class OfflineMediaCrypto {

    private static final BigInteger TWO_POW_128 = BigInteger.ONE.shiftLeft(128);

    private OfflineMediaCrypto() {}

    /** Adds {@code blockIndex} to the 16-byte {@code nonce}, treated as a big-endian 128-bit integer, mod 2^128. */
    static byte[] addCounter(byte[] nonce, long blockIndex) {
        BigInteger nonceInt = new BigInteger(1, nonce);
        BigInteger sum = nonceInt.add(BigInteger.valueOf(blockIndex)).mod(TWO_POW_128);
        byte[] raw = sum.toByteArray();
        // BigInteger.toByteArray() may prepend a sign byte or be shorter than 16 bytes; normalize to exactly 16.
        byte[] out = new byte[16];
        int copyLen = Math.min(raw.length, 16);
        System.arraycopy(raw, raw.length - copyLen, out, 16 - copyLen, copyLen);
        return out;
    }

    /** Encrypts a single 16-byte block with AES-ECB/NoPadding — used only to derive the CTR keystream. */
    private static byte[] aesEcbEncryptBlock(byte[] key, byte[] block) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/ECB/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"));
        return cipher.doFinal(block);
    }

    /**
     * Decrypts {@code ciphertext}, the byte range {@code [fileOffset, fileOffset + ciphertext.length)}
     * of an AES-256-CTR-encrypted file, given the file's 32-byte key and padded 16-byte nonce.
     */
    static byte[] decrypt(byte[] ciphertext, byte[] key, byte[] nonce, long fileOffset) throws GeneralSecurityException {
        if (key.length != 32) throw new IllegalArgumentException("key must be 32 bytes, got " + key.length);
        if (nonce.length != 16) throw new IllegalArgumentException("nonce must be 16 bytes, got " + nonce.length);
        if (ciphertext.length == 0) return new byte[0];

        long blockIndex = fileOffset / 16;
        int subOffset = (int) (fileOffset % 16);

        byte[] plaintext = new byte[ciphertext.length];
        int written = 0;
        long currentBlock = blockIndex;
        boolean isFirstBlock = true;

        while (written < ciphertext.length) {
            byte[] counterBlock = addCounter(nonce, currentBlock);
            byte[] keystream = aesEcbEncryptBlock(key, counterBlock);

            int skip = isFirstBlock ? subOffset : 0;
            int takeCount = Math.min(16 - skip, ciphertext.length - written);

            for (int i = 0; i < takeCount; i++) {
                plaintext[written + i] = (byte) (ciphertext[written + i] ^ keystream[skip + i]);
            }

            written += takeCount;
            currentBlock += 1;
            isFirstBlock = false;
        }

        return plaintext;
    }
}
