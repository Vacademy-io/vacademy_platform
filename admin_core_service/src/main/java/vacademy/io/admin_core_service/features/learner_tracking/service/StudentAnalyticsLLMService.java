package vacademy.io.admin_core_service.features.learner_tracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;
import vacademy.io.admin_core_service.features.ai_usage.enums.ApiProvider;
import vacademy.io.admin_core_service.features.ai_usage.enums.RequestType;
import vacademy.io.admin_core_service.features.ai_usage.service.AiTokenUsageService;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Service to analyze student activity data using LLM
 * Implements fallback mechanism with model priority
 */
@Slf4j
@Service
public class StudentAnalyticsLLMService {

        private static final String API_URL = "https://openrouter.ai";
        private static final int RESPONSE_TIMEOUT_SECONDS = 30;

        // Model priority list - fallback order
        private static final List<String> MODEL_PRIORITY = List.of(
                        "xiaomi/mimo-v2-flash:free",
                        "mistralai/devstral-2512:free",
                        "nvidia/nemotron-3-nano-30b-a3b:free");
        private static final int MAX_RETRIES_PER_MODEL = 2;

        private final WebClient webClient;
        private final ObjectMapper objectMapper;
        private final AiTokenUsageService aiTokenUsageService;

        public StudentAnalyticsLLMService(
                        @Value("${openrouter.api.key}") String apiKey,
                        ObjectMapper objectMapper,
                        AiTokenUsageService aiTokenUsageService) {
                this.objectMapper = objectMapper;
                this.aiTokenUsageService = aiTokenUsageService;

                this.webClient = WebClient.builder()
                                .baseUrl(API_URL)
                                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                                .build();
        }

        /**
         * Generate student insights from raw activity data
         * Implements fallback mechanism across multiple models
         * 
         * @param rawJson      The raw JSON string containing student submission data
         * @param activityType Type of activity (quiz, question, assignment, assessment)
         * @return Mono containing the processed insights as JsonNode
         */
        public Mono<JsonNode> generateStudentInsights(String rawJson, String activityType) {
                String prompt = createStudentAnalysisPrompt(rawJson, activityType);

                // Try each model in priority order with retries
                return tryModelsWithFallback(prompt, 0);
        }

        /**
         * Recursively try models with fallback logic
         * 
         * @param prompt     The prompt to send to LLM
         * @param modelIndex Current model index in priority list
         * @return Mono containing the insights or error
         */
        private Mono<JsonNode> tryModelsWithFallback(String prompt, int modelIndex) {
                if (modelIndex >= MODEL_PRIORITY.size()) {
                        log.error("All LLM models failed after retries. Tried: {}", MODEL_PRIORITY);
                        return Mono.error(new RuntimeException("All LLM models failed. Tried: " + MODEL_PRIORITY));
                }

                String currentModel = MODEL_PRIORITY.get(modelIndex);

                return generateWithModel(prompt, currentModel)
                                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2))
                                                .doBeforeRetry(signal -> log.warn(
                                                                "Retry {}/{} for model: {}",
                                                                signal.totalRetries() + 1, MAX_RETRIES_PER_MODEL,
                                                                currentModel))
                                                .onRetryExhaustedThrow((spec, signal) -> {
                                                        log.error("Model {} exhausted retries ({})",
                                                                        currentModel, MAX_RETRIES_PER_MODEL);
                                                        return signal.failure();
                                                }))
                                .onErrorResume(error -> {
                                        log.warn("Model {} failed: {}. Trying next model...",
                                                        currentModel, error.getMessage());
                                        return tryModelsWithFallback(prompt, modelIndex + 1);
                                });
        }

        /**
         * Generate insights with specific model
         */
        private Mono<JsonNode> generateWithModel(String prompt, String model) {
                Map<String, Object> payload = Map.of(
                                "model", model,
                                "messages", List.of(
                                                Map.of("role", "system", "content",
                                                                "You are an expert educational data analyst specializing in student performance analysis. "
                                                                                + "You analyze student submission data and provide actionable insights in strict JSON format."),
                                                Map.of("role", "user", "content", prompt)),
                                "response_format", Map.of("type", "json_object"));

                return webClient.post()
                                .uri("/api/v1/chat/completions")
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                                .doOnNext(response -> logTokenUsage(response, model))
                                .flatMap(response -> parseResponse(response, model));
        }

        /**
         * Log token usage from API response
         */
        private void logTokenUsage(String responseBody, String model) {
                try {
                        JsonNode root = objectMapper.readTree(responseBody);
                        JsonNode usage = root.get("usage");

                        if (usage != null) {
                                int promptTokens = usage.has("prompt_tokens") ? usage.get("prompt_tokens").asInt() : 0;
                                int completionTokens = usage.has("completion_tokens")
                                                ? usage.get("completion_tokens").asInt()
                                                : 0;

                                aiTokenUsageService.recordUsageAsync(
                                                ApiProvider.OPENAI,
                                                RequestType.ANALYTICS,
                                                model,
                                                promptTokens,
                                                completionTokens,
                                                null, // No institute ID in this context
                                                null // No user ID in this context
                                );
                        }
                } catch (Exception e) {
                        log.warn("Failed to log token usage: {}", e.getMessage());
                }
        }

        private String createStudentAnalysisPrompt(String rawJson, String activityType) {
                return """
                                Analyze the following student submission data and generate comprehensive insights.

                                Activity Type: %s

                                Student Submission Data:
                                %s

                                Generate a JSON response with the following structure:
                                {
                                  "performance_analysis": "Detailed markdown analysis of overall performance including correct/incorrect answers, time management, patterns observed",
                                  "weaknesses": {
                                    "topic_name_1": 30,
                                    "topic_name_2": 45
                                  },
                                  "strengths": {
                                    "topic_name_1": 90,
                                    "topic_name_2": 85
                                  },
                                  "areas_of_improvement": "Markdown formatted list of specific areas where student needs improvement with explanations",
                                  "improvement_path": "Markdown formatted step-by-step study plan tailored to address weaknesses. Include specific topics, resources, and learning strategies",
                                  "flashcards": [
                                    {
                                      "front": "Concept or question the student struggled with",
                                      "back": "Clear explanation or answer"
                                    }
                                  ]
                                }

                                Important Guidelines:
                                1. Performance Analysis: Write 2-3 paragraphs analyzing the STUDENT'S performance - their understanding, accuracy, and learning patterns. Focus on what the student knows/doesn't know, NOT on system functionality.
                                2. Weaknesses/Strengths: Use topic names from the questions, score 0-100 based on performance
                                3. Areas of Improvement: List 3-5 specific areas with markdown bullets and explanations
                                4. Improvement Path: Create a structured learning path with:
                                   - Step-by-step progression (Step 1, Step 2, etc.)
                                   - Specific topics to review
                                   - Practice recommendations
                                   - Expected time commitment
                                5. Flashcards: Generate 5-10 flashcards focusing on concepts the student got wrong or struggled with

                                CRITICAL: Base your analysis ONLY on:
                                - Student's actual response text/content
                                - Auto-evaluation JSON data (marks awarded, feedback, explanations)
                                - Question content and correct answers provided
                                - Time spent on each question (if available)
                                - DO NOT rely on any "is_correct" or similar boolean flags - these may be inaccurate
                                - Evaluate correctness by comparing student response with correct answers and auto-evaluation data
                                - Focus ENTIRELY on the student's learning and performance, NOT on system evaluation or technical aspects

                                Return ONLY valid JSON. Be specific and actionable in your recommendations.
                                """
                                .formatted(activityType, rawJson);
        }

        private Mono<JsonNode> parseResponse(String responseBody, String model) {
                try {
                        JsonNode root = objectMapper.readTree(responseBody);
                        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");

                        if (contentNode.isMissingNode()) {
                                return Mono.error(new RuntimeException("Invalid response from LLM: No content found"));
                        }

                        String contentString = contentNode.asText();

                        // Clean up if wrapped in markdown code blocks
                        if (contentString.startsWith("```json")) {
                                contentString = contentString.replace("```json", "").replace("```", "").trim();
                        } else if (contentString.startsWith("```")) {
                                contentString = contentString.replace("```", "").trim();
                        }

                        JsonNode parsedContent = objectMapper.readTree(contentString);
                        return Mono.just(parsedContent);

                } catch (Exception e) {
                        log.error("Error parsing LLM response from model {}: {}", model, e.getMessage());
                        return Mono.error(new RuntimeException("Failed to parse LLM response: " + e.getMessage(), e));
                }
        }
}
