package vacademy.io.media_service.service;

import java.security.SecureRandom;

/**
 * Modular short code generator.
 * To change the strategy used across the app, change the single call in generateShortCode().
 * Each strategy is a standalone static method — swap by name, not by logic.
 */
public class ShortCodeGenerator {

    private static final SecureRandom RANDOM = new SecureRandom();

    // Base32 alphabet: uppercase letters + digits 2-7 (RFC 4648), URL-safe, no ambiguous chars
    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int DEFAULT_LENGTH = 8;

    /**
     * Entry point. Swap the method call here to change strategy globally.
     */
    public static String generateShortCode(String hint) {
        return bookNameSlug(hint);
        // Other strategies ready to use:
        // return randomBase32(DEFAULT_LENGTH);
        // return randomBase62(DEFAULT_LENGTH);
    }

    /**
     * Append a random suffix to a slug for collision resolution.
     * Example: "compiler-design" → "compiler-design-a3k7"
     */
    public static String appendRandomSuffix(String slug) {
        return slug + "-" + randomBase32(4).toLowerCase();
    }

    /**
     * Strategy 1: Random Base32 (uppercase + 2-7).
     * Example: "K7MNPQ3A"
     * URL-safe, no ambiguous chars (0/O, 1/I/l), easy to read aloud.
     */
    public static String randomBase32(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(BASE32_ALPHABET.charAt(RANDOM.nextInt(BASE32_ALPHABET.length())));
        }
        return sb.toString();
    }

    /**
     * Strategy 2: Random Base62 (a-z, A-Z, 0-9).
     * Example: "xK9mPq2f"
     * More combinations per character, case-sensitive.
     */
    public static String randomBase62(int length) {
        String alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    /**
     * Strategy 3: Book/content name slug.
     * Example: "compiler-design" (from "Compiler Design")
     * Human-readable. Caller should handle collisions by appending a suffix.
     */
    public static String bookNameSlug(String title) {
        if (title == null || title.isBlank()) return randomBase32(DEFAULT_LENGTH);
        String slug = title.trim()
                .toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-{2,}", "-");
        return slug.substring(0, Math.min(slug.length(), 50));
    }
}
