package vacademy.io.media_service.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * Utility class for generating unique identifiers.
 * Consolidates duplicate ID generation logic from various services.
 */
public final class IdGenerationUtils {

    private static final int DEFAULT_ID_LENGTH = 20;
    private static final String DATE_FORMAT = "yyyyMMddHHmmssSSS";

    private IdGenerationUtils() {
        // Private constructor to prevent instantiation
    }

    /**
     * Generates a unique ID based on input string and current timestamp.
     * Uses SHA-256 hashing and Base64 encoding for uniqueness.
     *
     * @param input The input string to use as seed for ID generation
     * @return A unique 20-character Base64 encoded string
     */
    public static String generateUniqueId(String input) {
        return generateUniqueId(input, DEFAULT_ID_LENGTH);
    }

    /**
     * Generates a unique ID based on input string and current timestamp with custom
     * length.
     *
     * @param input  The input string to use as seed for ID generation
     * @param length The desired length of the returned ID
     * @return A unique Base64 encoded string of specified length
     */
    public static String generateUniqueId(String input, int length) {
        try {
            String timestamp = new SimpleDateFormat(DATE_FORMAT).format(new Date());
            String combined = (input != null ? input : "") + "-" + timestamp;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            String base64Encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

            return base64Encoded.substring(0, Math.min(length, base64Encoded.length()));
        } catch (NoSuchAlgorithmException e) {
            // Fallback to UUID if SHA-256 is not available (highly unlikely)
            return UUID.randomUUID().toString().replace("-", "").substring(0, length);
        }
    }

    /**
     * Generates a random UUID string.
     *
     * @return A random UUID string without dashes
     */
    public static String generateRandomId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * Generates a task name with random suffix.
     *
     * @param baseName The base name for the task
     * @return Task name with 4-digit random suffix and date
     */
    public static String generateTaskName(String baseName) {
        String datePart = new SimpleDateFormat("yyyyMMdd").format(new Date());
        int randomPart = (int) (Math.random() * 10000);
        return String.format("%s_%04d_%s", baseName, randomPart, datePart);
    }
}
