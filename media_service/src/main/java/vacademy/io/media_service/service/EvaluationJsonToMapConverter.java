package vacademy.io.media_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

public class EvaluationJsonToMapConverter {

    public static Map<String, Object> convertJsonToMap(String jsonString) {
        Map<String, Object> result = new HashMap<>();
        ObjectMapper objectMapper = new ObjectMapper();

        try {
            JsonNode rootNode = objectMapper.readTree(jsonString);
            String type = rootNode.get("type").asText();

            // Handle different types
            switch (type) {
                case "MCQS":
                    result = handleMCQM(rootNode);
                    break;
                case "MCQM":
                    result = handleMCQM(rootNode);
                    break;
                default:
                    result = handleDefaultType(rootNode);
                    break;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return result;
    }

    private static Map<String, Object> handleMCQS(JsonNode rootNode) {
        Map<String, Object> map = new HashMap<>();
        // Your custom logic to handle type1
        map.put("correct_option_id", rootNode.get("data").asText());
        map.put("key2", rootNode.get("key2").asInt());
        return map;
    }

    private static Map<String, Object> handleMCQM(JsonNode rootNode) {
        // Create a new HashMap to store the results
        Map<String, Object> map = new HashMap<>();

        // Create a list to hold the correct option IDs
        List<String> correctOptionIds = new ArrayList<>();

        // Extract correct option IDs from the JSON node
        rootNode.get("data").get("correct_option_ids").forEach(optionIdNode -> {
            correctOptionIds.add(optionIdNode.asText());
        });

        // Put the list of correct option IDs into the map
        map.put("correctOptionIds", correctOptionIds);

        // Return the populated map
        return map;
    }

    private static Map<String, Object> handleDefaultType(JsonNode rootNode) {
        Map<String, Object> map = new HashMap<>();
        // Default handling logic
        Iterator<Map.Entry<String, JsonNode>> fields = rootNode.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            map.put(field.getKey(), field.getValue().asText());
        }
        return map;
    }

    public static void main(String[] args) {
        String json = "{\"type\":\"type1\", \"key1\":\"value1\", \"key2\":123}";
        Map<String, Object> result = convertJsonToMap(json);
        System.out.println(result);
    }
}
