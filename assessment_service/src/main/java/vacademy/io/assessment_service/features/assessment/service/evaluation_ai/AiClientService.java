package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.AiGradingResponseDto;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Service for handling AI API communication via OpenRouter
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiClientService {

        private final ObjectMapper objectMapper;

        @Value("${openrouter.api.key}")
        private String openRouterApiKey;

        private static final String API_URL = "https://openrouter.ai";
        private static final int RESPONSE_TIMEOUT_SECONDS = 60;
        private static final int MAX_RETRIES_PER_MODEL = 2;

        /**
         * Create WebClient for OpenRouter API
         */
        public WebClient createWebClient() {
                return WebClient.builder()
                                .baseUrl(API_URL)
                                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + openRouterApiKey)
                                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                                .defaultHeader("HTTP-Referer", "https://vacademy.io")
                                .defaultHeader("X-Title", "Vacademy Assessment Evaluator")
                                .build();
        }

        /**
         * Call AI for grading with the given prompt and model
         */
        public Mono<AiGradingResponseDto> callAiForGrading(String prompt, String model, WebClient webClient) {
                // Use preferred model or fallback
                String modelToUse = (model != null && !model.isEmpty()) ? model : "mistralai/devstral-2512:free";
                log.info("Using AI model: {} for grading", modelToUse);

                Map<String, Object> payload = Map.of(
                                "model", modelToUse,
                                "messages", List.of(
                                                Map.of("role", "system", "content",
                                                                "You are an expert evaluator. Grade the student's answer based strictly on the provided rubric."),
                                                Map.of("role", "user", "content", prompt)),
                                "response_format", Map.of("type", "json_object"));

                log.info("Sending AI request with prompt length: {}", prompt.length());

                return webClient.post()
                                .uri("/api/v1/chat/completions")
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                                .doOnNext(response -> log.info("Received AI response, length: {}", response.length()))
                                .map(this::parseGradingResponse)
                                .doOnNext(result -> {
                                        if (result != null) {
                                                log.debug("Successfully parsed AI grading response");
                                        } else {
                                                log.warn("Failed to parse AI grading response");
                                        }
                                })
                                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2)))
                                .doOnError(error -> log.error("AI call failed after retries: {}", error.getMessage()))
                                .onErrorResume(e -> {
                                        log.error("AI call failed: {}", e.getMessage());
                                        return Mono.empty();
                                });
        }

        /**
         * Call AI for answer extraction (used by AiAnswerExtractionService)
         */
        public Mono<String> callAiForExtraction(String prompt, String model, WebClient webClient) {
                String modelToUse = (model != null && !model.isEmpty()) ? model : "mistralai/devstral-2512:free";
                log.info("Using AI model: {} for answer extraction", modelToUse);

                Map<String, Object> payload = Map.of(
                                "model", modelToUse,
                                "messages", List.of(
                                                Map.of("role", "system", "content",
                                                                "You are an expert at extracting answers from Markdown documents with LaTeX equations. Extract answers accurately without evaluating them."),
                                                Map.of("role", "user", "content", prompt)),
                                "response_format", Map.of("type", "json_object"));

                return webClient.post()
                                .uri("/api/v1/chat/completions")
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2)));
        }

        /**
         * Call AI for batch extraction (used by AiAnswerExtractionService)
         */
        public Mono<String> callAiForBatchExtraction(String prompt, String model, WebClient webClient) {
                String modelToUse = (model != null && !model.isEmpty()) ? model : "mistralai/devstral-2512:free";
                log.info("Using AI model: {} for BATCH answer extraction", modelToUse);

                Map<String, Object> payload = Map.of(
                                "model", modelToUse,
                                "messages", List.of(
                                                Map.of("role", "system", "content",
                                                                "You are an expert at extracting answers from Markdown documents. Extract ALL answers accurately in a single response."),
                                                Map.of("role", "user", "content", prompt)),
                                "response_format", Map.of("type", "json_object"));

                return webClient.post()
                                .uri("/api/v1/chat/completions")
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(Duration.ofSeconds(60)) // Longer timeout for batch
                                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2)));
        }

        /**
         * Parse AI grading response
         */
        private AiGradingResponseDto parseGradingResponse(String responseBody) {
                try {
                        log.info("Parsing AI response, raw response length: {}", responseBody.length());
                        JsonNode root = objectMapper.readTree(responseBody);
                        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
                        String contentString = contentNode.asText();

                        log.info("Extracted content from AI response, length: {}", contentString.length());

                        if (contentString.startsWith("```json")) {
                                contentString = contentString.replace("```json", "").replace("```", "").trim();
                                log.debug("Cleaned JSON content from markdown, new length: {}", contentString.length());
                        } else if (contentString.startsWith("```")) {
                                contentString = contentString.replace("```", "").trim();
                                log.debug("Cleaned content from markdown, new length: {}", contentString.length());
                        }

                        AiGradingResponseDto result = objectMapper.readValue(contentString, AiGradingResponseDto.class);

                        log.info("Successfully parsed AI grading response: marks={}, feedback length={}",
                                        result.getMarksAwarded(),
                                        result.getFeedback() != null ? result.getFeedback().length() : 0);
                        return result;
                } catch (Exception e) {
                        log.error("Failed to parse grading response: {}", e.getMessage());
                        log.debug("Raw response that failed to parse: {}", responseBody);
                        return null;
                }
        }

        /**
         * Extract content from AI response (used for extraction responses)
         */
        public String extractContentFromResponse(String response) throws Exception {
                JsonNode root = objectMapper.readTree(response);
                JsonNode content = root.path("choices").get(0).path("message").path("content");
                String contentString = content.asText();

                // Clean markdown if present
                if (contentString.startsWith("```json")) {
                        contentString = contentString.replace("```json", "").replace("```", "").trim();
                } else if (contentString.startsWith("```")) {
                        contentString = contentString.replace("```", "").trim();
                }

                return contentString;
        }
}
