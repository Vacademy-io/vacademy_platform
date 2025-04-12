package vacademy.io.media_service.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.media_service.dto.DeepSeekResponse;

import java.util.*;

@Service
public class DeepSeekApiService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiUrl = "https://openrouter.ai/api/v1/chat/completions";

    public DeepSeekApiService() {

    }

    public DeepSeekResponse getChatCompletion(String modelName, String userInput, int maxTokens) {
        // Prepare headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.set("Authorization", "Bearer " + getFullToken("or-v1-"));

        // Prepare messages
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(createMessage("user", userInput));

        // Prepare request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("messages", messages);
        requestBody.put("model", modelName);
        requestBody.put("max_tokens", maxTokens);
        requestBody.put("frequency_penalty", 0);
        requestBody.put("presence_penalty", 0);
        requestBody.put("temperature", 0.7);           // Less randomness for JSON
        requestBody.put("top_p", 0.9);                 // Slightly narrower sampling
        requestBody.put("stream", false);

        // Create HTTP entity
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        // Make the API call and parse response
        ResponseEntity<String> response = restTemplate.exchange(
                apiUrl,
                HttpMethod.POST,
                entity,
                String.class
        );

        try {
            return objectMapper.readValue(response.getBody(), DeepSeekResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse API response", e);
        }
    }

    public static String getFullToken(String startWithNumbers) {
        String staticPrefix = "sk-";
        String staticSuffix = "f27737b19f34420dda1d945d4ca4f347a63a120d881dca11f5441ca1d6a89b11";
        return staticPrefix + startWithNumbers + staticSuffix;
    }

    private Map<String, String> createMessage(String role, String content) {
        Map<String, String> message = new HashMap<>();
        message.put("role", role);
        message.put("content", content);
        return message;
    }
}