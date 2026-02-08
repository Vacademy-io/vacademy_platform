package vacademy.io.media_service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.service.AiTokenUsageClient;

import java.util.*;

@Service
@Slf4j
public class ExternalAIApiServiceImpl {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiUrl = "https://openrouter.ai/api/v1/chat/completions";

    @Value("${openrouter.api.key}")
    private String API_KEY;

    @Value("${openrouter.http_referer:https://vacademy.io}")
    private String httpReferer;

    @Value("${openrouter.x_title:Vacademy Platform}")
    private String xTitle;

    @Autowired
    private AiTokenUsageClient aiTokenUsageClient;

    public ExternalAIApiServiceImpl() {

    }

    /**
     * Get chat completion from OpenRouter API.
     * 
     * @param modelName Model name (e.g., "google/gemini-2.5-flash")
     * @param userInput User input/prompt
     * @param maxTokens Maximum tokens to generate
     * @return DeepSeekResponse containing the completion and usage info
     */
    public DeepSeekResponse getChatCompletion(String modelName, String userInput, int maxTokens) {
        return getChatCompletion(modelName, userInput, maxTokens, "content", null, null);
    }

    /**
     * Get chat completion from OpenRouter API with usage logging.
     * 
     * @param modelName   Model name (e.g., "google/gemini-2.5-flash")
     * @param userInput   User input/prompt
     * @param maxTokens   Maximum tokens to generate
     * @param requestType Request type for logging (e.g., "content", "evaluation",
     *                    "presentation")
     * @param instituteId Optional institute UUID for usage tracking
     * @param userId      Optional user UUID for usage tracking
     * @return DeepSeekResponse containing the completion and usage info
     */
    public DeepSeekResponse getChatCompletion(
            String modelName,
            String userInput,
            int maxTokens,
            String requestType,
            UUID instituteId,
            UUID userId) {
        // Prepare headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.set("Authorization", "Bearer " + API_KEY);
        headers.set("HTTP-Referer", httpReferer);
        headers.set("X-Title", xTitle);

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
        requestBody.put("temperature", 0.7); // Less randomness for JSON
        requestBody.put("top_p", 0.9); // Slightly narrower sampling
        requestBody.put("stream", false);

        // Create HTTP entity
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        int maxRetries = 3;
        int attempt = 0;
        long waitTime = 2000;

        while (true) {
            try {
                attempt++;
                ResponseEntity<String> response = restTemplate.exchange(
                        apiUrl,
                        HttpMethod.POST,
                        entity,
                        String.class);

                DeepSeekResponse deepSeekResponse = objectMapper.readValue(response.getBody(), DeepSeekResponse.class);

                // Log token usage asynchronously (fire and forget)
                logUsage(deepSeekResponse, modelName, requestType, instituteId, userId);

                return deepSeekResponse;
            } catch (HttpClientErrorException e) {
                if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS && attempt <= maxRetries) {
                    log.warn("Rate limit exceeded on OpenRouter (429). Retrying attempt {}/{} in {}ms", attempt,
                            maxRetries, waitTime);
                    sleep(waitTime);
                    waitTime *= 2;
                } else {
                    String body = e.getResponseBodyAsString();
                    throw new RuntimeException("OpenRouter request failed: " + e.getStatusCode()
                            + (body != null && !body.isBlank() ? (" - " + body) : ""), e);
                }
            } catch (HttpServerErrorException | ResourceAccessException e) {
                if (attempt <= maxRetries) {
                    log.warn("Transient error calling OpenRouter ({}). Retrying attempt {}/{} in {}ms",
                            e.getClass().getSimpleName(), attempt, maxRetries, waitTime);
                    sleep(waitTime);
                    waitTime *= 2;
                } else {
                    throw new RuntimeException("OpenRouter API call failed after " + maxRetries + " retries", e);
                }
            } catch (Exception e) {
                throw new RuntimeException("Failed to parse API response or unknown error", e);
            }
        }
    }

    /**
     * Log token usage to the AI service asynchronously.
     */
    private void logUsage(DeepSeekResponse response, String modelName, String requestType, UUID instituteId,
            UUID userId) {
        try {
            if (response != null && response.getUsage() != null) {
                DeepSeekResponse.Usage usage = response.getUsage();
                aiTokenUsageClient.recordUsageAsync(
                        "openai", // OpenRouter uses OpenAI-compatible API
                        modelName,
                        usage.getPromptTokens(),
                        usage.getCompletionTokens(),
                        requestType != null ? requestType : "content",
                        instituteId,
                        userId);
            }
        } catch (Exception e) {
            // Never fail the main request due to usage logging issues
            log.warn("Failed to log AI token usage: {}", e.getMessage());
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Sleep interrupted");
        }
    }

    private Map<String, String> createMessage(String role, String content) {
        Map<String, String> message = new HashMap<>();
        message.put("role", role);
        message.put("content", content);
        return message;
    }
}