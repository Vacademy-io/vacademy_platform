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
import vacademy.io.admin_core_service.features.ai_models.service.AIModelRegistryService;
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
        private static final int RESPONSE_TIMEOUT_SECONDS = 120;

        // Model priority list - fallback order
        private static final List<String> FALLBACK_MODEL_PRIORITY = List.of(
                        "nvidia/nemotron-3-nano-30b-a3b:free",
                        "arcee-ai/trinity-large-preview:free",
                        "z-ai/glm-4.5-air:free");
        private static final int MAX_RETRIES_PER_MODEL = 2;

        private final WebClient webClient;
        private final ObjectMapper objectMapper;
        private final AiTokenUsageService aiTokenUsageService;
        private final AIModelRegistryService aiModelRegistryService;

        public StudentAnalyticsLLMService(
                        @Value("${openrouter.api.key}") String apiKey,
                        ObjectMapper objectMapper,
                        AiTokenUsageService aiTokenUsageService,
                        AIModelRegistryService aiModelRegistryService) {
                this.objectMapper = objectMapper;
                this.aiTokenUsageService = aiTokenUsageService;
                this.aiModelRegistryService = aiModelRegistryService;

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

                List<String> modelPriority = aiModelRegistryService.getModelPriority("analytics");
                if (modelPriority.isEmpty()) {
                        modelPriority = FALLBACK_MODEL_PRIORITY;
                }

                log.debug("[LLM-Analytics] Model priority size: {}, ActivityType: {}, PromptChars: {}",
                                modelPriority.size(), activityType, prompt.length());

                // Try each model in priority order with retries
                return tryModelsWithFallback(prompt, modelPriority, 0);
        }

        /**
         * Recursively try models with fallback logic
         * 
         * @param prompt     The prompt to send to LLM
         * @param modelIndex Current model index in priority list
         * @return Mono containing the insights or error
         */
        private Mono<JsonNode> tryModelsWithFallback(String prompt, List<String> modelPriority, int modelIndex) {
                if (modelIndex >= modelPriority.size()) {
                        log.error("All LLM models failed after retries. Tried: {}", modelPriority);
                        return Mono.error(new RuntimeException("All LLM models failed. Tried: " + modelPriority));
                }

                String currentModel = modelPriority.get(modelIndex);

                log.debug("[LLM-Analytics] Trying model {}/{}: {}",
                                modelIndex + 1, modelPriority.size(), currentModel);

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
                                        return tryModelsWithFallback(prompt, modelPriority, modelIndex + 1);
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

                long requestStart = System.nanoTime();

                return webClient.post()
                                .uri("/api/v1/chat/completions")
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                                .doOnSubscribe(sub -> log.debug("[LLM-Analytics] POST {} model={} payloadChars={}",
                                                API_URL + "/api/v1/chat/completions", model, prompt.length()))
                                .doOnNext(response -> {
                                        long durationMs = Duration.ofNanos(System.nanoTime() - requestStart).toMillis();
                                        log.debug("[LLM-Analytics] Response received model={} in {} ms, size={} chars",
                                                        model, durationMs, response.length());
                                        logTokenUsage(response, model);
                                })
                                .doOnError(error -> {
                                        long durationMs = Duration.ofNanos(System.nanoTime() - requestStart).toMillis();
                                        log.warn("[LLM-Analytics] Request failed model={} after {} ms: {}",
                                                        model, durationMs, error.getMessage());
                                })
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
                                Analyze the following student assessment submission and generate comprehensive AI-powered insights.

                                Activity Type: """
                                + activityType
                                + """


                                                Student Submission Data (includes question details, marks, class comparison):
                                                """
                                + rawJson
                                + """


                                                Generate a JSON response with ALL of the following sections:

                                                {
                                                  "performance_analysis": "2-3 paragraphs: overall performance, accuracy patterns, time usage, comparison with class if class_context is available",

                                                  "strengths": { "topic_name": 90 },
                                                  "weaknesses": { "topic_name": 30 },

                                                  "areas_of_improvement": "Markdown bullet list of 3-5 specific areas",

                                                  "improvement_path": "Markdown step-by-step study plan with topics, practice recommendations, time estimates",

                                                  "flashcards": [
                                                    { "front": "Concept the student got wrong", "back": "Clear explanation" }
                                                  ],

                                                  "confidence_estimation": {
                                                    "overall_confidence": 78,
                                                    "high_confidence_correct": 15,
                                                    "high_confidence_wrong": 2,
                                                    "low_confidence_correct": 3,
                                                    "guessed_correct": 5,
                                                    "insight": "1-2 sentences about student's confidence patterns"
                                                  },

                                                  "topic_analysis": [
                                                    {
                                                      "topic": "Inferred topic name from question content",
                                                      "questions_count": 5,
                                                      "correct": 4,
                                                      "accuracy": 80,
                                                      "avg_time_seconds": 52,
                                                      "mastery_level": "Expert|Proficient|Developing|Beginner"
                                                    }
                                                  ],

                                                  "misconception_analysis": [
                                                    {
                                                      "question_summary": "Brief question description",
                                                      "student_answer": "What student chose",
                                                      "correct_answer": "What was correct",
                                                      "misconception": "Why the student got it wrong — the underlying conceptual error",
                                                      "remediation": "Specific advice to fix this misconception"
                                                    }
                                                  ],

                                                  "blooms_taxonomy": {
                                                    "remember": { "total": 5, "correct": 5 },
                                                    "understand": { "total": 8, "correct": 6 },
                                                    "apply": { "total": 7, "correct": 4 },
                                                    "analyze": { "total": 5, "correct": 2 },
                                                    "evaluate": { "total": 3, "correct": 1 },
                                                    "create": { "total": 2, "correct": 0 }
                                                  },

                                                  "behavioral_insights": {
                                                    "time_management": "Analysis of how student allocated time across questions",
                                                    "difficulty_response": "How student performed across easy/medium/hard questions",
                                                    "fatigue_indicator": "Whether accuracy dropped in later questions",
                                                    "skip_pattern": "Analysis of skipped questions or very fast responses"
                                                  },

                                                  "recommended_learning_path": [
                                                    {
                                                      "priority": 1,
                                                      "topic": "Topic name",
                                                      "current_level": "Beginner|Developing|Proficient",
                                                      "target_level": "Proficient|Expert",
                                                      "suggestion": "Specific actionable study advice",
                                                      "estimated_time": "2-3 hours"
                                                    }
                                                  ]
                                                }

                                                GUIDELINES:
                                                1. TOPICS: Infer topic names from question text content. Group similar questions under the same topic.
                                                2. CONFIDENCE: Estimate from time_taken + difficulty + correctness. Fast correct = high confidence. Slow wrong = low confidence. Very fast wrong = likely guessed.
                                                3. BLOOM'S TAXONOMY: Classify each question into a cognitive level based on question wording:
                                                   - Remember: recall facts (define, list, name)
                                                   - Understand: explain concepts (describe, explain, summarize)
                                                   - Apply: use in new situations (calculate, solve, demonstrate)
                                                   - Analyze: break down (compare, contrast, differentiate)
                                                   - Evaluate: justify decisions (evaluate, judge, critique)
                                                   - Create: produce new work (design, construct, formulate)
                                                4. MISCONCEPTIONS: Only for INCORRECT questions. Explain the specific conceptual error, not just "wrong answer."
                                                5. BEHAVIORAL: Use time_taken per question data. Look for patterns (rushing, fatigue, difficulty avoidance).
                                                6. COMPARISON: If class_context is present, reference rank/percentile/class averages in performance_analysis.
                                                7. FLASHCARDS: 5-10 cards focusing on concepts from wrong/partial answers.
                                                8. LEARNING PATH: 3-5 steps ordered by priority (weakest topics first).

                                                CRITICAL: Use the "status" field (CORRECT/INCORRECT/PARTIAL_CORRECT) as the source of truth for correctness.
                                                Return ONLY valid JSON. No markdown outside JSON strings.
                                                """;
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
