package vacademy.io.admin_core_service.features.credits.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client for communicating with the AI Service's credit management endpoints.
 * 
 * This client handles:
 * - Initializing credits for new institutes
 * - Checking credit balance (pre-flight)
 * - Deducting credits after AI operations
 */
@Slf4j
@Service
public class CreditClient {

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;

    public CreditClient(
            RestTemplate restTemplate,
            @Value("${ai.service.url:http://localhost:8077}") String aiServiceUrl) {
        this.restTemplate = restTemplate;
        this.aiServiceUrl = aiServiceUrl;
    }

    /**
     * Initialize credits for a new institute (gives them 200 initial credits).
     * Called asynchronously when an institute is created.
     */
    @Async
    public CompletableFuture<Void> initializeCreditsAsync(String instituteId) {
        return CompletableFuture.runAsync(() -> {
            try {
                initializeCredits(instituteId);
            } catch (Exception e) {
                log.error("Failed to initialize credits for institute {}: {}", instituteId, e.getMessage());
            }
        });
    }

    /**
     * Initialize credits for a new institute (synchronous).
     */
    public void initializeCredits(String instituteId) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/institutes/" + instituteId + "/initialize";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>("{}", headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully initialized credits for institute {}", instituteId);
            } else {
                log.warn("Failed to initialize credits for institute {}: {}", instituteId, response.getStatusCode());
            }
        } catch (RestClientException e) {
            log.error("Error calling credit initialization API for institute {}: {}", instituteId, e.getMessage());
        }
    }

    /**
     * Check if institute has sufficient credits for an operation.
     * 
     * @param instituteId     The institute ID
     * @param requestType     Type of request (content, image, embedding, etc.)
     * @param model           The model being used (for pricing multiplier)
     * @param estimatedTokens Estimated token count
     * @return true if sufficient credits, false otherwise
     */
    public boolean checkCredits(String instituteId, String requestType, String model, int estimatedTokens) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/check";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "institute_id", instituteId,
                    "request_type", requestType,
                    "model", model != null ? model : "",
                    "estimated_tokens", estimatedTokens);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Boolean hasSufficientCredits = (Boolean) response.getBody().get("has_sufficient_credits");
                return hasSufficientCredits != null && hasSufficientCredits;
            }

            // If check fails, allow the request (fail open)
            log.warn("Credit check failed for institute {}, allowing request", instituteId);
            return true;

        } catch (Exception e) {
            log.error("Error checking credits for institute {}: {}", instituteId, e.getMessage());
            // Fail open - allow the request if we can't check
            return true;
        }
    }

    /**
     * Deduct credits after an AI operation (async).
     * 
     * @param instituteId      The institute ID
     * @param requestType      Type of request (content, image, embedding, etc.)
     * @param model            The model used
     * @param promptTokens     Number of prompt tokens
     * @param completionTokens Number of completion tokens
     * @param usageLogId       Optional link to ai_token_usage record
     */
    @Async
    public CompletableFuture<Void> deductCreditsAsync(
            String instituteId,
            String requestType,
            String model,
            int promptTokens,
            int completionTokens,
            String usageLogId) {
        return CompletableFuture.runAsync(() -> {
            try {
                deductCredits(instituteId, requestType, model, promptTokens, completionTokens, usageLogId);
            } catch (Exception e) {
                log.error("Failed to deduct credits for institute {}: {}", instituteId, e.getMessage());
            }
        });
    }

    /**
     * Deduct credits after an AI operation (synchronous).
     */
    public void deductCredits(
            String instituteId,
            String requestType,
            String model,
            int promptTokens,
            int completionTokens,
            String usageLogId) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/deduct";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "institute_id", instituteId,
                    "request_type", requestType != null ? requestType : "content",
                    "model", model != null ? model : "unknown",
                    "prompt_tokens", promptTokens,
                    "completion_tokens", completionTokens,
                    "usage_log_id", usageLogId != null ? usageLogId : "");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.debug("Successfully deducted credits for institute {}", instituteId);
            } else {
                log.warn("Failed to deduct credits for institute {}: {}", instituteId, response.getStatusCode());
            }
        } catch (RestClientException e) {
            log.error("Error deducting credits for institute {}: {}", instituteId, e.getMessage());
        }
    }

    /**
     * Get current credit balance for an institute.
     * 
     * @param instituteId The institute ID
     * @return Map with balance info, or null if failed
     */
    public Map<String, Object> getBalance(String instituteId) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/institutes/" + instituteId + "/balance";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>(headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                return response.getBody();
            }

            return null;
        } catch (Exception e) {
            log.error("Error getting balance for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }
}
