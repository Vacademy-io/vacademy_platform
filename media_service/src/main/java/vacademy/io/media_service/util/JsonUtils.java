package vacademy.io.media_service.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.json.JsonSanitizer;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class JsonUtils {
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final Pattern FINAL_JSON_PATTERN = Pattern.compile(
            "```json\\s*(\\{.*?\\})\\s*```",
            Pattern.DOTALL
    );

    public static String extractAndSanitizeFinalJsonBlock(String llmResponse) {
        Matcher matcher = FINAL_JSON_PATTERN.matcher(llmResponse);
        List<JsonNode> validBlocks = new ArrayList<>();

        // 1. Find and parse all matching JSON blocks
        while (matcher.find()) {
            String jsonString = matcher.group(1);
            try {
                JsonNode rootNode = objectMapper.readTree(jsonString);
                // A block is considered valid if it contains both keys.
                if (rootNode.has("explanation") && rootNode.has("todos")) {
                    validBlocks.add(rootNode);
                }
            } catch (JsonProcessingException e) {
                // Silently skip malformed JSON blocks or log a warning
                System.err.println("Warning: Skipping malformed JSON block. " + e.getMessage());
            }
        }

        if (validBlocks.isEmpty()) {
            throw new VacademyException("Final output JSON block not found in response.");
        }

        // 2. Merge the valid blocks
        // The explanation from the last valid block will be used.
        JsonNode finalExplanation = validBlocks.get(validBlocks.size() - 1).get("explanation");
        ArrayNode mergedTodos = objectMapper.createArrayNode();

        for (JsonNode block : validBlocks) {
            JsonNode todosNode = block.get("todos");
            if (todosNode != null && todosNode.isArray()) {
                // Add all elements from this block's 'todos' array to the merged list
                mergedTodos.addAll((ArrayNode) todosNode);
            }
        }

        // 3. Reconstruct the final JSON object
        ObjectNode finalJson = objectMapper.createObjectNode();
        finalJson.set("explanation", finalExplanation);
        finalJson.set("todos", mergedTodos);

        try {
            // Return the final, merged JSON as a string
            return objectMapper.writeValueAsString(finalJson);
        } catch (JsonProcessingException e) {
            // This exception is highly unlikely here but is required to be handled.
            throw new IllegalStateException("Failed to serialize the final merged JSON object.", e);
        }
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