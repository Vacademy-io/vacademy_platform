package vacademy.io.media_service.course.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vacademy.io.media_service.course.dto.EmbeddingRequest;
import vacademy.io.media_service.course.dto.EmbeddingResponse;
import vacademy.io.media_service.service.AiTokenUsageClient;

import java.util.Collections;
import java.util.List;

@Slf4j
@Component
public class GeminiApiClient {

    @Value("${gemini.api.key}")
    private String API_KEY;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AiTokenUsageClient aiTokenUsageClient;

    public GeminiApiClient(AiTokenUsageClient aiTokenUsageClient) {
        this.aiTokenUsageClient = aiTokenUsageClient;
    }

    public List<Float> getEmbedding(String content, String taskType, Integer outputDimensionality) {
        try {
            // Create request DTO
            EmbeddingRequest request = new EmbeddingRequest();
            request.setContent(new EmbeddingRequest.Content(new EmbeddingRequest.Part(content)));
            request.setTaskType(taskType);
            request.setOutputDimensionality(outputDimensionality);

            // Prepare endpoint
            String endpoint = String.format(
                    "https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s",
                    "text-embedding-004", API_KEY);

            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Request entity
            HttpEntity<String> requestEntity = new HttpEntity<>(objectMapper.writeValueAsString(request), headers);

            // REST call
            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<EmbeddingResponse> response = restTemplate.exchange(
                    endpoint,
                    HttpMethod.POST,
                    requestEntity,
                    EmbeddingResponse.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // Log token usage for embedding
                logTokenUsage(content);
                return response.getBody().getEmbedding().getValues();
            }

        } catch (Exception e) {
            log.error("Error during embedding generation", e);
        }
        return Collections.emptyList();
    }

    /**
     * Log token usage for embedding generation
     */
    private void logTokenUsage(String content) {
        try {
            // Estimate tokens based on content length (roughly 4 chars per token)
            int estimatedTokens = Math.max(1, content.length() / 4);

            aiTokenUsageClient.recordUsageAsync(
                    "gemini",
                    "text-embedding-004",
                    estimatedTokens,
                    0, // Embeddings don't have completion tokens
                    "embedding",
                    null,
                    null);
        } catch (Exception e) {
            log.warn("Failed to log embedding usage: {}", e.getMessage());
        }
    }

    private String escapeJson(String input) {
        return input.replace("\"", "\\\"");
    }
}
