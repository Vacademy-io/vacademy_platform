/**
 * Device-local offline encryption key (plan §B1/§B9 — confirmed decision:
 * NO server key custody, NO DRM).
 *
 * One random AES-256 key per user, generated on first use and stored ONLY in
 * hardware-backed secure storage (iOS Keychain / Android Keystore via
 * @aparajita/capacitor-secure-storage; obfuscated storage on Electron). The
 * key never leaves the device, so `.enc` files + SQLite rows copied to
 * another device are undecryptable by construction.
 *
 * The raw key bytes exist only (a) base64 inside secure storage and (b) as a
 * non-extractable-in-practice in-memory CryptoKey while content is open.
 */

import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const KEY_PREFIX = "offline.key.v1.";
const AES_KEY_BYTES = 32;

/** In-memory cache: userId → imported CryptoKey. Cleared on logout. */
const keyCache = new Map<string, CryptoKey>();

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", rawKey as BufferSource, { name: "AES-CTR" }, false, [
        "encrypt",
        "decrypt",
    ]);
}

/**
 * Returns the user's device-local AES-256 key as a WebCrypto CryptoKey
 * (AES-CTR, non-extractable), generating and persisting it on first use.
 */
export async function getOrCreateOfflineKey(userId: string): Promise<CryptoKey> {
    const cached = keyCache.get(userId);
    if (cached) return cached;

    const storageKey = `${KEY_PREFIX}${userId}`;
    let rawB64 = await SecureStorage.getItem(storageKey);

    if (!rawB64) {
        const raw = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES));
        rawB64 = bytesToBase64(raw);
        await SecureStorage.setItem(storageKey, rawB64);
        raw.fill(0);
    }

    const keyBytes = base64ToBytes(rawB64);
    const cryptoKey = await importAesKey(keyBytes);
    keyBytes.fill(0);

    keyCache.set(userId, cryptoKey);
    return cryptoKey;
}

/** Logout hook: drop in-memory keys (secure-storage copy stays, per plan B9). */
export function clearKeyCache(): void {
    keyCache.clear();
}

/**
 * Returns the user's raw base64 AES-256 key bytes, generating on first use
 * (same key `getOrCreateOfflineKey` imports as a non-extractable CryptoKey).
 *
 * NATIVE-PLUGIN-ONLY: the `OfflineMedia` native plugin boundary
 * (src/lib/offline/native/offline-media.ts `openAsset`) is JS-primitive-only
 * — it cannot accept a WebCrypto `CryptoKey` object, only raw base64 bytes.
 * This is the single legitimate place raw key material leaves secure storage
 * as a plain string; it must go straight into `openAsset` and never be
 * logged, cached beyond the call, or persisted anywhere else.
 */
export async function getRawOfflineKeyB64(userId: string): Promise<string> {
    const storageKey = `${KEY_PREFIX}${userId}`;
    let rawB64 = await SecureStorage.getItem(storageKey);
    if (!rawB64) {
        // Reuse the existing generate-and-persist path so both accessors
        // always agree on the same underlying key.
        await getOrCreateOfflineKey(userId);
        rawB64 = await SecureStorage.getItem(storageKey);
    }
    if (!rawB64) {
        throw new Error(`getRawOfflineKeyB64: failed to obtain offline key for user ${userId}`);
    }
    return rawB64;
}

/**
 * Full local wipe for a user (e.g. device revoked): removes the persisted key
 * so even the encrypted remnants become permanently unreadable.
 */
export async function destroyOfflineKey(userId: string): Promise<void> {
    keyCache.delete(userId);
    await SecureStorage.removeItem(`${KEY_PREFIX}${userId}`);
}
