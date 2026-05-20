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

    // Extract and sanitize JSON from raw response.
    // Uses balanced-bracket scanning so chain-of-thought text containing stray
    // braces (e.g. "if x > 0 { ... }") doesn't truncate the real JSON.
    // Supports both top-level objects and top-level arrays.
    //
    // When the response contains multiple balanced blocks (e.g. an LLM emits a
    // small JSON-shaped fragment in chain-of-thought before the real payload),
    // we try candidates longest-first and return the first one that parses as
    // valid JSON. This is strictly safer than always picking the first or
    // always picking the longest: if the only valid block is small, we still
    // find it; if the longest valid block is the real answer, we prefer it.
    public static String extractAndSanitizeJson(String rawResponse) {
        if (rawResponse == null) {
            throw new IllegalArgumentException("No JSON found in the response");
        }

        List<String> candidates = findBalancedBlocks(rawResponse);
        // Try candidates longest-first.
        candidates.sort((a, b) -> Integer.compare(b.length(), a.length()));
        for (String candidate : candidates) {
            try {
                String sanitized = JsonSanitizer.sanitize(candidate);
                objectMapper.readTree(sanitized);
                return sanitized;
            } catch (Exception ignored) {
                // try next candidate
            }
        }

        // Legacy fallback: first-{ / last-} (or first-[ / last-]) bounds. Kept
        // for backwards compatibility — handles responses whose JSON contains
        // an unmatched bracket inside a non-string region that the balanced
        // scanner can't resolve.
        String jsonContent = null;
        int start = rawResponse.indexOf('{');
        int altStart = rawResponse.indexOf('[');
        if (altStart != -1 && (start == -1 || altStart < start)) {
            int end = rawResponse.lastIndexOf(']') + 1;
            if (end > altStart) jsonContent = rawResponse.substring(altStart, end);
        } else if (start != -1) {
            int end = rawResponse.lastIndexOf('}') + 1;
            if (end > start) jsonContent = rawResponse.substring(start, end);
        }
        if (jsonContent == null) {
            throw new IllegalArgumentException("No JSON found in the response");
        }

        String sanitizedJson = JsonSanitizer.sanitize(jsonContent);
        try {
            objectMapper.readTree(sanitizedJson);
            return sanitizedJson;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse sanitized JSON", e);
        }
    }

    /**
     * Scans for all balanced {...} and [...] blocks, respecting strings and
     * escapes. Returns blocks in the order they appear in the input.
     */
    private static List<String> findBalancedBlocks(String input) {
        List<String> blocks = new ArrayList<>();
        int n = input.length();
        for (int i = 0; i < n; i++) {
            char c = input.charAt(i);
            if (c != '{' && c != '[') continue;
            char open = c;
            char close = (open == '{') ? '}' : ']';
            int depth = 0;
            boolean inString = false;
            boolean escape = false;
            for (int j = i; j < n; j++) {
                char ch = input.charAt(j);
                if (escape) { escape = false; continue; }
                if (ch == '\\') { escape = true; continue; }
                if (ch == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (ch == open) depth++;
                else if (ch == close) {
                    depth--;
                    if (depth == 0) {
                        blocks.add(input.substring(i, j + 1));
                        break;
                    }
                }
            }
            // unbalanced for this opener; try next
        }
        return blocks;
    }
}