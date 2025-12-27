package vacademy.io.admin_core_service.features.student_analysis.service;

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
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentAnalysisData;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentReportData;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service to generate student analysis reports using LLM
 * Fixed memory leaks with proper connection pooling
 * Implements fallback mechanism with model priority
 */
@Slf4j
@Service
public class StudentReportLLMService {

        private static final String API_URL = "https://openrouter.ai";
        private static final int RESPONSE_TIMEOUT_SECONDS = 60;

        // Model priority list - fallback order
        private static final List<String> MODEL_PRIORITY = List.of(
                        "xiaomi/mimo-v2-flash:free",
                        "mistralai/devstral-2512:free",
                        "nvidia/nemotron-3-nano-30b-a3b:free");
        private static final int MAX_RETRIES_PER_MODEL = 2;

        private final WebClient webClient;
        private final ObjectMapper objectMapper;

        public StudentReportLLMService(@Value("${openrouter.api.key}") String apiKey, ObjectMapper objectMapper) {
                this.objectMapper = objectMapper;

                this.webClient = WebClient.builder()
                                .baseUrl(API_URL)
                                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                                .build();
        }

        /**
         * Generate comprehensive student report from aggregated data
         * Implements fallback mechanism across multiple models
         */
        public Mono<StudentReportData> generateStudentReport(StudentAnalysisData data) {
                log.info("[Student-Report-LLM] Generating report for date range: {} to {}",
                                data.getStartDateIso(), data.getEndDateIso());

                String prompt = createStudentReportPrompt(data);

                // Try each model in priority order with retries
                return tryModelsWithFallback(prompt, 0);
        }

        /**
         * Recursively try models with fallback logic
         * 
         * @param prompt     The prompt to send to LLM
         * @param modelIndex Current model index in priority list
         * @return Mono containing the report or error
         */
        private Mono<StudentReportData> tryModelsWithFallback(String prompt, int modelIndex) {
                if (modelIndex >= MODEL_PRIORITY.size()) {
                        log.error("[Student-Report-LLM] All models failed after retries");
                        return Mono.error(new RuntimeException("All LLM models failed. Tried: " + MODEL_PRIORITY));
                }

                String currentModel = MODEL_PRIORITY.get(modelIndex);
                log.info("[Student-Report-LLM] Attempting with model: {} (priority {})", currentModel, modelIndex + 1);

                return generateWithModel(prompt, currentModel)
                                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2))
                                                .doBeforeRetry(signal -> log.warn(
                                                                "[Student-Report-LLM] Retry {}/{} for model: {}",
                                                                signal.totalRetries() + 1, MAX_RETRIES_PER_MODEL,
                                                                currentModel))
                                                .onRetryExhaustedThrow((spec, signal) -> {
                                                        log.error("[Student-Report-LLM] Model {} exhausted retries ({})",
                                                                        currentModel, MAX_RETRIES_PER_MODEL);
                                                        return signal.failure();
                                                }))
                                .onErrorResume(error -> {
                                        log.error("[Student-Report-LLM] Model {} failed: {}. Trying next model...",
                                                        currentModel, error.getMessage());
                                        return tryModelsWithFallback(prompt, modelIndex + 1);
                                });
        }

        /**
         * Generate report with specific model
         */
        private Mono<StudentReportData> generateWithModel(String prompt, String model) {
                Map<String, Object> payload = Map.of(
                                "model", model,
                                "messages", List.of(
                                                Map.of("role", "system", "content",
                                                                "You are an expert educational analyst specializing in comprehensive student performance evaluation. "
                                                                                +
                                                                                "You analyze student activity data, learning patterns, and engagement metrics to provide detailed insights in strict JSON format."),
                                                Map.of("role", "user", "content", prompt)),
                                "response_format", Map.of("type", "json_object"));

                return webClient.post()
                                .uri("/api/v1/chat/completions")
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                                .flatMap(response -> parseResponse(response, model));
        }

        private String createStudentReportPrompt(StudentAnalysisData data) {
                return String.format(
                                """
                                                Analyze the following comprehensive student data and generate a detailed performance report.

                                                **Date Range:** %s to %s

                                                **Login Activity:**
                                                - Total Logins: %d
                                                - Last Login: %s
                                                - Average Session Duration: %.1f minutes
                                                - Total Active Time: %d minutes (%.1f hours)

                                                **Processed Activity Insights (Last 5):**
                                                %s

                                                **Learning Operations Summary:**
                                                %s

                                                Generate a JSON response with the following structure:
                                                {
                                                  "learning_frequency": "Markdown formatted analysis of student's learning patterns, frequency of engagement, consistency in activities, and peak learning times. Include specific observations about login patterns and activity completion rates.",

                                                  "progress": "Markdown formatted comprehensive analysis of student's progress over the time period. Include improvements in performance, completion rates, engagement trends, and milestone achievements. Compare early vs. recent activities.",

                                                  "topics_of_improvement": "Markdown formatted list of topics where the student showed improvement or mastery. Include specific topics, percentage improvements, and evidence from the data. Use bullet points with explanations.",

                                                  "topics_of_degradation": "Markdown formatted list of topics where performance declined or showed concerning patterns. Include specific topics, areas of struggle, and supporting evidence. Use bullet points with explanations.",

                                                  "remedial_points": "Markdown formatted actionable recommendations for improvement. Include:
                                                  - Specific learning strategies
                                                  - Time management suggestions
                                                  - Topic-specific study plans
                                                  - Engagement improvement tactics
                                                  - Practice recommendations
                                                  Use numbered list format with detailed explanations.",

                                                  "strengths": {
                                                    "topic_name_1": 85,
                                                    "topic_name_2": 90
                                                  },

                                                  "weaknesses": {
                                                    "topic_name_1": 35,
                                                    "topic_name_2": 42
                                                  }
                                                }

                                                **Important Guidelines:**
                                                1. **Learning Frequency:** Focus on consistency, engagement patterns, time gaps between activities, and learning habits
                                                2. **Progress:** Highlight both positive trends and areas needing attention. Be specific with data points
                                                3. **Topics of Improvement:** Extract topic names from activity data. Score 70-100 for strong performance
                                                4. **Topics of Degradation:** Identify declining performance areas. Score 0-50 for weak areas
                                                5. **Remedial Points:** Provide 5-10 specific, actionable recommendations tailored to the student's needs
                                                6. **Strengths/Weaknesses:** Use actual topic names from the data with percentage scores (0-100)

                                                **Analysis Focus:**
                                                - Base insights on actual activity data and learning operations
                                                - Look for patterns in video watching, quiz completion, document reading
                                                - Consider time spent, completion percentages, and marked activities
                                                - Identify topics from processed activity insights
                                                - Be specific and data-driven in all recommendations
                                                - Use straight forward language suitable for students and educators
                                                - Focus ENTIRELY on the student's learning and performance, NOT on system evaluation or technical aspects

                                                Return ONLY valid JSON. Be thorough, specific, and actionable in your analysis.
                                                """,
                                data.getStartDateIso(),
                                data.getEndDateIso(),
                                data.getTotalLogins(),
                                data.getLastLoginTime() != null ? data.getLastLoginTime() : "No data",
                                data.getAvgSessionDurationMinutes(),
                                data.getTotalActiveTimeMinutes(),
                                data.getTotalActiveTimeMinutes() / 60.0,
                                formatActivityLogs(data.getProcessedActivityLogs()),
                                formatLearnerOperations(data.getLearnerOperations()));
        }

        private String formatActivityLogs(List<String> logs) {
                if (logs == null || logs.isEmpty()) {
                        return "No processed activity logs available.";
                }

                StringBuilder formatted = new StringBuilder();
                for (int i = 0; i < logs.size(); i++) {
                        formatted.append(String.format("Activity %d:\n%s\n\n", i + 1, logs.get(i)));
                }
                return formatted.toString();
        }

        private String formatLearnerOperations(
                        List<vacademy.io.admin_core_service.features.student_analysis.dto.LearnerOperationSummary> operations) {
                if (operations == null || operations.isEmpty()) {
                        return "No learner operations recorded.";
                }

                StringBuilder formatted = new StringBuilder();
                for (var op : operations) {
                        formatted.append(String.format("- Source: %s, Operation: %s, Value: %s, Time: %s\n",
                                        op.getSource(), op.getOperation(), op.getValue(), op.getTimestamp()));
                }
                return formatted.toString();
        }

        private Mono<StudentReportData> parseResponse(String responseBody, String model) {
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

                        // Parse into StudentReportData
                        StudentReportData reportData = StudentReportData.builder()
                                        .learningFrequency(parsedContent.path("learning_frequency").asText())
                                        .progress(parsedContent.path("progress").asText())
                                        .topicsOfImprovement(parsedContent.path("topics_of_improvement").asText())
                                        .topicsOfDegradation(parsedContent.path("topics_of_degradation").asText())
                                        .remedialPoints(parsedContent.path("remedial_points").asText())
                                        .strengths(parseTopicMap(parsedContent.path("strengths")))
                                        .weaknesses(parseTopicMap(parsedContent.path("weaknesses")))
                                        .build();

                        log.info("[Student-Report-LLM] Successfully generated report using model: {}", model);
                        return Mono.just(reportData);

                } catch (Exception e) {
                        log.error("[Student-Report-LLM] Error parsing LLM response from model {}: {}", model,
                                        e.getMessage());
                        return Mono.error(new RuntimeException("Failed to parse LLM response: " + e.getMessage(), e));
                }
        }

        private Map<String, Integer> parseTopicMap(JsonNode node) {
                Map<String, Integer> result = new HashMap<>();
                if (node.isObject()) {
                        node.fields().forEachRemaining(entry -> {
                                result.put(entry.getKey(), entry.getValue().asInt());
                        });
                }
                return result;
        }
}
