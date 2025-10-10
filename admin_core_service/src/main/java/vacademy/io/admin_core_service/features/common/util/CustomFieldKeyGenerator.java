package vacademy.io.admin_core_service.features.common.util;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class CustomFieldKeyGenerator {

    private static final Pattern SPECIAL_CHARS_PATTERN = Pattern.compile("[^a-zA-Z0-9_]");
    private static final Pattern MULTIPLE_UNDERSCORES_PATTERN = Pattern.compile("_+");

    /**
     * Generates a consistent field key from field name
     * Rules:
     * 1. Convert to lowercase
     * 2. Replace spaces and special characters with underscores
     * 3. Remove multiple consecutive underscores
     * 4. Ensure it starts with a letter or underscore
     * 5. Ensure it doesn't end with underscore
     * 
     * @param fieldName The field name to convert to key
     * @return Generated field key
     */
    public String generateFieldKey(String fieldName) {
        if (!StringUtils.hasText(fieldName)) {
            throw new IllegalArgumentException("Field name cannot be null or empty");
        }

        // Convert to lowercase
        String key = fieldName.toLowerCase(Locale.ENGLISH);

        // Replace spaces and special characters with underscores
        key = SPECIAL_CHARS_PATTERN.matcher(key).replaceAll("_");

        // Replace multiple consecutive underscores with single underscore
        key = MULTIPLE_UNDERSCORES_PATTERN.matcher(key).replaceAll("_");

        // Remove leading/trailing underscores
        key = key.replaceAll("^_+|_+$", "");

        // Ensure it starts with a letter (not underscore or number)
        if (key.isEmpty() || Character.isDigit(key.charAt(0))) {
            key = "field_" + key;
        }

        // Ensure minimum length
        if (key.length() < 2) {
            key = key + "_field";
        }

        return key;
    }

    /**
     * Generates a unique field key by appending timestamp if needed
     * This method should be used when creating new custom fields to ensure
     * uniqueness
     * 
     * @param fieldName    The field name to convert to key
     * @param existingKeys List of existing keys to check against
     * @return Unique field key
     */
    public String generateUniqueFieldKey(String fieldName, java.util.List<String> existingKeys) {
        String baseKey = generateFieldKey(fieldName);

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


