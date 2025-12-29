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
import vacademy.io.admin_core_service.features.student_analysis.entity.UserLinkedData;
import vacademy.io.admin_core_service.features.student_analysis.repository.UserLinkedDataRepository;
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
        private final UserLinkedDataRepository userLinkedDataRepository;

        public StudentReportLLMService(@Value("${openrouter.api.key}") String apiKey, ObjectMapper objectMapper,
                        UserLinkedDataRepository userLinkedDataRepository) {
                this.objectMapper = objectMapper;
                this.userLinkedDataRepository = userLinkedDataRepository;

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

                // Fetch existing user-linked data
                List<UserLinkedData> existingData = userLinkedDataRepository.findByUserId(data.getUserId());

                String prompt = createStudentReportPrompt(data, existingData);

                // Try each model in priority order with retries
                return tryModelsWithFallback(prompt, 0, data.getUserId());
        }

        /**
         * Recursively try models with fallback logic
         * 
         * @param prompt     The prompt to send to LLM
         * @param modelIndex Current model index in priority list
         * @param userId     The user ID for the report
         * @return Mono containing the report or error
         */
        private Mono<StudentReportData> tryModelsWithFallback(String prompt, int modelIndex, String userId) {
                if (modelIndex >= MODEL_PRIORITY.size()) {
                        log.error("[Student-Report-LLM] All models failed after retries");
                        return Mono.error(new RuntimeException("All LLM models failed. Tried: " + MODEL_PRIORITY));
                }

                String currentModel = MODEL_PRIORITY.get(modelIndex);

                return generateWithModel(prompt, currentModel, userId)
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
                                        return tryModelsWithFallback(prompt, modelIndex + 1, userId);
                                });
        }

        /**
         * Generate report with specific model
         */
        private Mono<StudentReportData> generateWithModel(String prompt, String model, String userId) {
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
                                .flatMap(response -> parseResponse(response, model, userId));
        }

        private String createStudentReportPrompt(StudentAnalysisData data, List<UserLinkedData> existingData) {
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

                                                **Existing Strengths and Weaknesses:**
                                                %s

                                                Generate a JSON response with the following structure:
                                                {
                                                  "learning_frequency": "Markdown formatted detailed analysis of learning patterns and engagement.",
                                                  "progress": "Markdown formatted comprehensive analysis of progress and trends.",
                                                  "student_efforts": "Markdown formatted detailed summary of efforts put in, including time spent and activities completed.",
                                                  "topics_of_improvement": "Markdown formatted detailed list of improved topics with explanations and evidence.",
                                                  "topics_of_degradation": "Markdown formatted detailed list of declined topics with explanations and evidence.",
                                                  "remedial_points": "Markdown formatted detailed actionable recommendations.",
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
                                                6. **Strengths/Weaknesses:** Generate new strengths and weaknesses based on the current data if actually needed. Update existing scores if the topics match exactly or are very similar (e.g., consolidate 'basic_arithmetic' and 'math_execution' into 'arithmetic'). Avoid creating duplicates by merging related topics under consistent names. Use strict naming format: Title Case (e.g., 'Basic Arithmetic', 'Math Execution') for all topic names to ensure consistency and prevent duplicates. Focus on meaningful academic subjects, skills, and topics relevant to student learning, such as Mathematics, Science, Language Arts, History, Algebra, P-block, Motion, Reading Comprehension, Problem Solving, etc. Avoid vague, unrelated, or nonsensical terms (e.g., use 'Spelling' instead of 'Geographic Spelling' or 'Spelling Accuracy'). Ensure topics are specific, educational, and directly related to the student's performance data.

                                                Guidelines:
                                                - Base on actual data and incorporate existing assessments.
                                                - Strengths/Weaknesses: Output the new list, updating existing where applicable, ensuring no duplicates and merging similar topics. Generate topics that are meaningful and directly related to student performance in academic areas.
                                                - Ensure all fields are populated with detailed, descriptive content; do not leave any empty.
                                                - Be data-driven, specific, and actionable.
                                                - Identify patterns, trends, and correlations.
                                                - Provide evidence-based observations.
                                                - Suggest practical, personalized strategies for improvement.
                                                - Use straightforward language suitable for educators, students and parents.
                                                - Return ONLY valid JSON.
                                                """,
                                data.getStartDateIso(),
                                data.getEndDateIso(),
                                data.getTotalLogins(),
                                data.getLastLoginTime() != null ? data.getLastLoginTime() : "No data",
                                data.getAvgSessionDurationMinutes(),
                                data.getTotalActiveTimeMinutes(),
                                data.getTotalActiveTimeMinutes() / 60.0,
                                formatActivityLogs(data.getProcessedActivityLogs()),
                                formatLearnerOperations(data.getLearnerOperations()),
                                formatExistingData(existingData));
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

        private String formatExistingData(List<UserLinkedData> existingData) {
                if (existingData == null || existingData.isEmpty()) {
                        return "No existing strengths and weaknesses recorded.";
                }

                StringBuilder formatted = new StringBuilder();
                for (UserLinkedData data : existingData) {
                        formatted.append(String.format("- %s: %s (%d%%)\n",
                                        data.getType(), data.getData(), data.getPercentage()));
                }
                return formatted.toString();
        }

        private Mono<StudentReportData> parseResponse(String responseBody, String model, String userId) {
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
                                        .studentEfforts(parsedContent.path("student_efforts").asText())
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
