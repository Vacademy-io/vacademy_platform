package vacademy.io.media_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Client for recording AI token usage via the AI Service API.
 * 
 * This client sends token usage data to the AI Service's internal recording
 * endpoint.
 * All methods are non-blocking and will not throw exceptions to avoid affecting
 * the main business logic.
 * 
 * Usage example:
 * 
 * <pre>
 * aiTokenUsageClient.recordUsageAsync(
 *         "openai",
 *         "google/gemini-2.5-flash",
 *         100, // promptTokens
 *         50, // completionTokens
 *         "content",
 *         instituteId,
 *         userId);
 * </pre>
 */
@Service
@Slf4j
public class AiTokenUsageClient {

    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public AiTokenUsageClient() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Record token usage asynchronously (fire and forget).
     * This method will not block the main thread and will silently handle any
     * errors.
     * 
     * @param apiProvider      API provider: "openai" or "gemini"
     * @param model            Model name (e.g., "google/gemini-2.5-flash")
     * @param promptTokens     Number of input tokens
     * @param completionTokens Number of output tokens
     * @param requestType      Request type: outline, image, content, video,
     *                         embedding, evaluation, etc.
     * @param instituteId      Optional institute UUID
     * @param userId           Optional user UUID
     */
    @Async
    public void recordUsageAsync(
            String apiProvider,
            String model,
            int promptTokens,
            int completionTokens,
            String requestType,
            UUID instituteId,
            UUID userId) {
        recordUsageInternal(
                apiProvider, model, promptTokens, completionTokens,
                requestType, instituteId, userId, null, null, null, null);
    }

    /**
     * Record token usage synchronously.
     * Returns true if the usage was recorded successfully, false otherwise.
     */
    public boolean recordUsage(
            String apiProvider,
            String model,
            int promptTokens,
            int completionTokens,
            String requestType,
            UUID instituteId,
            UUID userId) {
        return recordUsageInternal(
                apiProvider, model, promptTokens, completionTokens,
                requestType, instituteId, userId, null, null, null, null);
    }

    /**
     * Record token usage with full options asynchronously.
     */
    @Async
    public void recordUsageFullAsync(
            String apiProvider,
            String model,
            int promptTokens,
            int completionTokens,
            String requestType,
            UUID instituteId,
            UUID userId,
            String requestId,
            Map<String, Object> metadata,
            String ttsProvider,
            Integer characterCount) {
        recordUsageInternal(
                apiProvider, model, promptTokens, completionTokens,
                requestType, instituteId, userId, requestId, metadata, ttsProvider, characterCount);
    }

    /**
     * Record TTS usage asynchronously.
     * For TTS, character count is logged as prompt_tokens.
     * 
     * @param ttsProvider    TTS provider: google, edge, elevenlabs
     * @param characterCount Number of characters processed
     * @param instituteId    Institute UUID
     * @param userId         User UUID
     */
    @Async
    public void recordTtsUsageAsync(
            String ttsProvider,
            int characterCount,
            UUID instituteId,
            UUID userId) {
        recordUsageInternal(
                "gemini", // Use gemini for Google TTS
                "google-cloud-tts",
                characterCount, // Use prompt_tokens for character count
                0,
                "tts",
                instituteId,
                userId,
                null,
                null,
                ttsProvider,
                characterCount);
    }

    /**
     * Internal method to send usage data to AI Service.
     */
    private boolean recordUsageInternal(
            String apiProvider,
            String model,
            int promptTokens,
            int completionTokens,
            String requestType,
            UUID instituteId,
            UUID userId,
            String requestId,
            Map<String, Object> metadata,
            String ttsProvider,
            Integer characterCount) {
        try {
            String url = aiServiceUrl + "/ai-service/token-usage/v1/record";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("api_provider", apiProvider);
            requestBody.put("model", model);
            requestBody.put("prompt_tokens", promptTokens);
            requestBody.put("completion_tokens", completionTokens);
            requestBody.put("total_tokens", promptTokens + completionTokens);
            requestBody.put("request_type", requestType);

            if (instituteId != null) {
                requestBody.put("institute_id", instituteId.toString());
            }
            if (userId != null) {
                requestBody.put("user_id", userId.toString());
            }
            if (requestId != null) {
                requestBody.put("request_id", requestId);
            }
            if (metadata != null) {
                requestBody.put("metadata", metadata);
            }
            if (ttsProvider != null) {
                requestBody.put("tts_provider", ttsProvider);
            }
            if (characterCount != null) {
                requestBody.put("character_count", characterCount);
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.debug("Successfully recorded AI token usage: {} tokens for {}",
                        promptTokens + completionTokens, requestType);
                return true;
            } else {
                log.warn("Failed to record AI token usage. Status: {}, Response: {}",
                        response.getStatusCode(), response.getBody());
                return false;
            }

        } catch (Exception e) {
            // Log but don't throw - usage logging should not affect main business logic
            log.warn("Error recording AI token usage: {}", e.getMessage());
            return false;
        }
    }
}
