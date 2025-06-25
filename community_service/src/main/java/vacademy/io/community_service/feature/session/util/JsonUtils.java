package vacademy.io.community_service.feature.session.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.json.JsonSanitizer;


public class JsonUtils {
    private static final ObjectMapper objectMapper = new ObjectMapper();

    // Extract and sanitize JSON from raw response
    public static String extractAndSanitizeJson(String rawResponse) {
        // Extract the JSON substring (assuming it starts with '{' and ends with '}')
        int start = rawResponse.indexOf('{');
        int end = rawResponse.lastIndexOf('}') + 1;
        if (start == -1 || end == -1) {
            throw new IllegalArgumentException("No JSON found in the response");
        }
        String jsonContent = rawResponse.substring(start, end);

        // Sanitize the JSON
        String sanitizedJson = JsonSanitizer.sanitize(jsonContent);

        // Validate the JSON (optional)
        try {
            objectMapper.readTree(sanitizedJson);
            return sanitizedJson;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse sanitized JSON", e);
        }
    }
}