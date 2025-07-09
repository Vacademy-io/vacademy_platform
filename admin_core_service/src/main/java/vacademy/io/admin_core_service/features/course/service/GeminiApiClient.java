package vacademy.io.admin_core_service.features.course.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.util.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class GeminiApiClient {

    @Value("${openrouter.api.key}")
    private String API_KEY;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final String ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" + API_KEY;

    public List<Float> getEmbedding(String serializedContent, String model, String taskType) {
        List<Float> embedding = new ArrayList<>();

        try {
            // Build JSON request body
            String requestBody = """
            {
              "model": "%s",
              "content": {
                "parts": [
                  {
                    "text": "%s"
                  }
                ]
              },
              "taskType": "%s"
            }
        """.formatted(model, escapeJson(serializedContent), taskType);

            // Setup headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> requestEntity = new HttpEntity<>(requestBody, headers);

            // Make the request
            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<Map> response = restTemplate.exchange(
                    ENDPOINT,
                    HttpMethod.POST,
                    requestEntity,
                    Map.class
            );

            // Parse the embedding values from response
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Map<String, Object> embeddingMap = (Map<String, Object>) body.get("embedding");
                if (embeddingMap != null && embeddingMap.containsKey("values")) {
                    List<Double> values = (List<Double>) embeddingMap.get("values");
                    for (Double val : values) {
                        embedding.add(val.floatValue());
                    }
                }
            }

        } catch (Exception e) {
            e.printStackTrace(); // Log the exception properly in production code
        }

        return embedding;
    }

    private String escapeJson(String input) {
        return input.replace("\"", "\\\"");
    }
}
