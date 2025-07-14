package vacademy.io.media_service.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.json.JsonSanitizer;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class JsonUtils {
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final Pattern FINAL_JSON_PATTERN = Pattern.compile(
            "```json\\s*(\\{.*?\\})\\s*```",
            Pattern.DOTALL
    );

    public static String extractFinalJsonBlock(String llmResponse) {
        Matcher matcher = FINAL_JSON_PATTERN.matcher(llmResponse);

        while (matcher.find()) {
            String jsonBlock = matcher.group(1);

            // Optional sanity check to ensure it's the final output
            if (jsonBlock.contains("\"explanation\"") &&
                    jsonBlock.contains("\"modifications\"") &&
                    jsonBlock.contains("\"todos\"")) {
                return jsonBlock;
            }
        }

        throw new IllegalArgumentException("Final output JSON block not found in response.");
    }

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