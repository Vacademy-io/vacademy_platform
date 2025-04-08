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
    private final String apiUrl = "https://api.deepseek.com/chat/completions";

    @Value("${spring.ai.openai.api-key}")
    private String deepSeekApiKey;

    public DeepSeekApiService() {

    }

    public DeepSeekResponse getChatCompletion(String modelName, String userInput, int maxTokens) {
        // Prepare headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.set("Authorization", "Bearer " + deepSeekApiKey);

        // Prepare messages
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(createMessage("system", "You are a helpful assistant"));
        messages.add(createMessage("user", userInput));

        // Prepare request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("messages", messages);
        requestBody.put("model", modelName);
        requestBody.put("max_tokens", maxTokens);
        requestBody.put("frequency_penalty", 0);
        requestBody.put("presence_penalty", 0);
        requestBody.put("temperature", 1);
        requestBody.put("top_p", 1);
        requestBody.put("response_format", Collections.singletonMap("type", "json_object"));
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

    private Map<String, String> createMessage(String role, String content) {
        Map<String, String> message = new HashMap<>();
        message.put("role", role);
        message.put("content", content);
        return message;
    }
}