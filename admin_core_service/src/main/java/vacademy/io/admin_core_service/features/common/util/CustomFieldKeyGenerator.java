package vacademy.io.admin_core_service.features.common.util;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class CustomFieldKeyGenerator {

    private static final Pattern SPECIAL_CHARS_PATTERN = Pattern.compile("[^a-zA-Z0-9_]");
    private static final Pattern MULTIPLE_UNDERSCORES_PATTERN = Pattern.compile("_+");

    public String generateFieldKey(String fieldName, String instituteId) {
        if (!StringUtils.hasText(fieldName)) {
            throw new IllegalArgumentException("Field name cannot be null or empty");
        }

        // Convert field name to lowercase
        String key = fieldName.toLowerCase(Locale.ENGLISH);

        // Replace spaces and special characters with underscores
        key = SPECIAL_CHARS_PATTERN.matcher(key).replaceAll("_");

        // Replace multiple consecutive underscores with single underscore
        key = MULTIPLE_UNDERSCORES_PATTERN.matcher(key).replaceAll("_");

        // Remove leading/trailing underscores
        key = key.replaceAll("^_+|_+$", "");

        // Ensure it starts with a letter
        if (key.isEmpty() || Character.isDigit(key.charAt(0))) {
            key = "field_" + key;
        }

        // Ensure minimum length
        if (key.length() < 2) {
            key = key + "_field";
        }

        // Append institute ID to make it unique per institute
        key = key + "_inst_" + instituteId;

        return key;
    }

    /**
     * Generates a unique field key by appending a counter if needed.
     * This method should be used when creating new custom fields to ensure uniqueness.
     *
     * @param fieldName    The field name to convert to key
     * @param instituteId  The institute ID to include in the key
     * @param existingKeys List of existing keys to check against
     * @return Unique field key
     */
    public String generateUniqueFieldKey(String fieldName, String instituteId, List<String> existingKeys) {
        String baseKey = generateFieldKey(fieldName, instituteId);

        if (existingKeys == null || existingKeys.isEmpty()) {
            return baseKey;
        }

        String uniqueKey = baseKey;
        int counter = 1;

        while (existingKeys.contains(uniqueKey)) {
            uniqueKey = baseKey + "_" + counter;
            counter++;
        }

        return uniqueKey;
    }
}
