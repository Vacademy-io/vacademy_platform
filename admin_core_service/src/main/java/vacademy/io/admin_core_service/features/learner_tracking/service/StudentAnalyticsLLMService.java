package vacademy.io.admin_core_service.features.learner_tracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import java.util.ArrayList;
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
         * Generate student insights from raw activity data (v2).
         * Pre-computes numerical stats, sends to LLM for reasoning, then merges.
         *
         * @param rawJson      The raw JSON string containing student submission data
         * @param activityType Type of activity (quiz, question, assignment, assessment)
         * @return Mono containing the merged v2 insights as JsonNode
         */
        public Mono<JsonNode> generateStudentInsights(String rawJson, String activityType) {
                ObjectNode preComputed = preComputeStats(rawJson, activityType);
                String prompt = createStudentAnalysisPrompt(rawJson, activityType, preComputed);

                return tryModelsWithFallback(prompt, 0)
                                .map(llmResponse -> mergeWithPreComputed(llmResponse, preComputed));
        }

        /**
         * Merge pre-computed backend stats with LLM-generated reasoning into a v2 response.
         */
        private JsonNode mergeWithPreComputed(JsonNode llmResponse, ObjectNode preComputed) {
                ObjectNode merged = objectMapper.createObjectNode();
                merged.put("version", 2);

                // Build quick_summary: pre-computed numbers + LLM band/encouragement
                ObjectNode quickSummary = preComputed.has("quick_summary")
                                ? (ObjectNode) preComputed.get("quick_summary").deepCopy()
                                : objectMapper.createObjectNode();
                String band = llmResponse.has("performance_band")
                                ? llmResponse.get("performance_band").asText("average")
                                : "average";
                // Normalize performance_band
                if (!List.of("excellent", "good", "average", "needs_work").contains(band)) {
                        band = "average";
                }
                quickSummary.put("performance_band", band);
                quickSummary.put("encouragement",
                                llmResponse.has("encouragement")
                                                ? llmResponse.get("encouragement").asText("")
                                                : "Keep working hard!");
                merged.set("quick_summary", quickSummary);

                // Pre-computed fields
                merged.set("section_scores", preComputed.path("section_scores"));
                merged.set("difficulty_breakdown", preComputed.path("difficulty_breakdown"));
                merged.set("time_analysis", preComputed.path("time_analysis"));
                if (preComputed.has("question_results")) {
                        merged.set("question_results", preComputed.get("question_results"));
                }

                // LLM-generated fields
                merged.set("performance_analysis", llmResponse.path("performance_analysis"));
                merged.set("strengths", llmResponse.has("strengths") ? llmResponse.get("strengths") : objectMapper.createObjectNode());
                merged.set("weaknesses", llmResponse.has("weaknesses") ? llmResponse.get("weaknesses") : objectMapper.createObjectNode());
                merged.set("conceptual_gaps", llmResponse.has("conceptual_gaps") ? llmResponse.get("conceptual_gaps") : objectMapper.createArrayNode());
                merged.set("improvement_path", llmResponse.path("improvement_path"));
                merged.set("flashcards", llmResponse.has("flashcards") ? llmResponse.get("flashcards") : objectMapper.createArrayNode());

                // Keep areas_of_improvement for backward compat if LLM provides it
                if (llmResponse.has("areas_of_improvement")) {
                        merged.set("areas_of_improvement", llmResponse.get("areas_of_improvement"));
                }

                return merged;
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

        /**
         * Pre-compute numerical stats from raw JSON that don't need LLM reasoning.
         * These are merged with LLM output to form the final v2 response.
         */
        public ObjectNode preComputeStats(String rawJson, String activityType) {
                ObjectNode stats = objectMapper.createObjectNode();
                try {
                        JsonNode raw = objectMapper.readTree(rawJson);
                        String type = raw.has("activity_type") ? raw.get("activity_type").asText() : activityType;

                        switch (type) {
                                case "assessment_attempt":
                                        computeAssessmentStats(raw, stats);
                                        break;
                                case "quiz_submission":
                                        computeQuizStats(raw, stats);
                                        break;
                                case "question_submission":
                                        computeQuestionStats(raw, stats);
                                        break;
                                default:
                                        computeGenericStats(raw, stats);
                                        break;
                        }
                } catch (Exception e) {
                        log.warn("Failed to pre-compute stats: {}", e.getMessage());
                }
                return stats;
        }

        private void computeAssessmentStats(JsonNode raw, ObjectNode stats) {
                ObjectNode quickSummary = objectMapper.createObjectNode();

                // Time from attempt node
                JsonNode attempt = raw.get("attempt");
                if (attempt != null) {
                        quickSummary.put("time_used_seconds", attempt.path("duration_seconds").asLong(0));
                        quickSummary.put("time_allowed_seconds", attempt.path("time_limit_seconds").asLong(0));
                }

                // Walk sections to compute everything from actual question data
                JsonNode sections = raw.get("sections");
                int totalQuestions = 0;
                int questionsAttempted = 0;
                int totalCorrect = 0;
                double computedTotalScore = 0;
                double computedMaxScore = 0;
                List<Long> timesPerQuestion = new ArrayList<>();
                int easyAttempted = 0, easyCorrect = 0;
                int mediumAttempted = 0, mediumCorrect = 0;
                int hardAttempted = 0, hardCorrect = 0;

                ArrayNode sectionScores = objectMapper.createArrayNode();
                ArrayNode questionResults = objectMapper.createArrayNode();

                if (sections != null && sections.isArray()) {
                        for (JsonNode section : sections) {
                                ObjectNode sectionScore = objectMapper.createObjectNode();
                                String sectionName = section.path("sectionName").asText("Unknown Section");
                                sectionScore.put("name", sectionName);

                                JsonNode questions = section.get("questions");
                                int sectionTotal = 0;
                                int sectionCorrect = 0;
                                double sectionMarks = 0;
                                // marksPerQuestion can be null in the JSON, treat null/0 as unknown
                                JsonNode mpqNode = section.get("marksPerQuestion");
                                double marksPerQuestion = (mpqNode != null && !mpqNode.isNull()) ? mpqNode.asDouble(0) : 0;
                                double sectionMaxMarks = section.path("totalMarks").asDouble(0);
                                long sectionTime = 0;

                                if (questions != null && questions.isArray()) {
                                        int qCount = questions.size();
                                        // Compute sectionMaxMarks if not set
                                        if (sectionMaxMarks <= 0) {
                                                if (marksPerQuestion > 0) {
                                                        sectionMaxMarks = qCount * marksPerQuestion;
                                                } else {
                                                        // Default: 1 mark per question if nothing is specified
                                                        marksPerQuestion = 1;
                                                        sectionMaxMarks = qCount;
                                                }
                                        } else if (marksPerQuestion <= 0 && qCount > 0) {
                                                // Derive marksPerQuestion from totalMarks / questionCount
                                                marksPerQuestion = sectionMaxMarks / qCount;
                                        }

                                        totalQuestions += questions.size();
                                        int questionOrder = 0;
                                        for (JsonNode q : questions) {
                                                questionOrder++;
                                                sectionTotal++;
                                                long timeTaken = q.path("timeTakenInSeconds").asLong(0);
                                                sectionTime += timeTaken;

                                                boolean hasResponse = hasStudentResponse(q);

                                                if (hasResponse) {
                                                        questionsAttempted++;
                                                        timesPerQuestion.add(timeTaken);
                                                }

                                                String difficulty = q.path("difficulty").asText("medium").toLowerCase();
                                                boolean isCorrect = determineCorrectness(q);

                                                switch (difficulty) {
                                                        case "easy":
                                                                if (hasResponse) easyAttempted++;
                                                                if (isCorrect) easyCorrect++;
                                                                break;
                                                        case "hard":
                                                                if (hasResponse) hardAttempted++;
                                                                if (isCorrect) hardCorrect++;
                                                                break;
                                                        default:
                                                                if (hasResponse) mediumAttempted++;
                                                                if (isCorrect) mediumCorrect++;
                                                                break;
                                                }

                                                if (isCorrect) {
                                                        sectionCorrect++;
                                                        totalCorrect++;
                                                        sectionMarks += marksPerQuestion > 0 ? marksPerQuestion : 1;
                                                }

                                                // Per-question result for charts
                                                ObjectNode qResult = objectMapper.createObjectNode();
                                                qResult.put("question_number", questionOrder);
                                                qResult.put("section", sectionName);
                                                qResult.put("correct", isCorrect);
                                                qResult.put("attempted", hasResponse);
                                                qResult.put("time_seconds", timeTaken);
                                                qResult.put("difficulty", difficulty);
                                                qResult.put("marked_for_review", q.path("isMarkedForReview").asBoolean(false));
                                                questionResults.add(qResult);
                                        }
                                }

                                sectionScore.put("score", sectionMarks);
                                sectionScore.put("max_score", sectionMaxMarks);
                                sectionScore.put("accuracy_pct", sectionTotal > 0 ? Math.round(sectionCorrect * 100.0 / sectionTotal) : 0);
                                sectionScore.put("time_spent_seconds", sectionTime);
                                sectionScores.add(sectionScore);

                                computedTotalScore += sectionMarks;
                                computedMaxScore += sectionMaxMarks;
                        }
                }

                // Use computed values, but fall back to raw summary if section computation fails
                JsonNode summary = raw.get("summary");
                double finalTotalScore = computedTotalScore;
                double finalMaxScore = computedMaxScore;

                // If our computation yielded 0 but the raw summary has data, use the raw summary
                if (summary != null) {
                        double rawScoredMarks = summary.path("scored_marks").asDouble(summary.path("total_score").asDouble(0));
                        double rawTotalMarks = summary.path("total_marks").asDouble(summary.path("max_score").asDouble(0));

                        if (finalTotalScore <= 0 && rawScoredMarks > 0) {
                                finalTotalScore = rawScoredMarks;
                        }
                        if (finalMaxScore <= 0 && rawTotalMarks > 0) {
                                finalMaxScore = rawTotalMarks;
                        }
                }

                quickSummary.put("total_score", finalTotalScore);
                quickSummary.put("max_score", finalMaxScore);
                quickSummary.put("accuracy_pct", finalMaxScore > 0
                                ? Math.round(finalTotalScore * 100.0 / finalMaxScore) : 0);
                quickSummary.put("questions_attempted", questionsAttempted);
                quickSummary.put("questions_total", totalQuestions);
                quickSummary.put("total_correct", totalCorrect);
                stats.set("quick_summary", quickSummary);
                stats.set("section_scores", sectionScores);
                stats.set("question_results", questionResults);

                // Difficulty breakdown
                ObjectNode difficultyBreakdown = objectMapper.createObjectNode();
                ObjectNode easy = objectMapper.createObjectNode();
                easy.put("attempted", easyAttempted);
                easy.put("correct", easyCorrect);
                difficultyBreakdown.set("easy", easy);
                ObjectNode medium = objectMapper.createObjectNode();
                medium.put("attempted", mediumAttempted);
                medium.put("correct", mediumCorrect);
                difficultyBreakdown.set("medium", medium);
                ObjectNode hard = objectMapper.createObjectNode();
                hard.put("attempted", hardAttempted);
                hard.put("correct", hardCorrect);
                difficultyBreakdown.set("hard", hard);
                stats.set("difficulty_breakdown", difficultyBreakdown);

                // Time analysis
                computeTimeAnalysis(timesPerQuestion, stats);
        }

        private void computeQuizStats(JsonNode raw, ObjectNode stats) {
                ObjectNode quickSummary = objectMapper.createObjectNode();
                JsonNode summary = raw.get("summary");
                if (summary != null) {
                        quickSummary.put("total_score", summary.path("total_score").asDouble(0));
                        quickSummary.put("max_score", summary.path("max_score").asDouble(0));
                        quickSummary.put("accuracy_pct", Math.round(summary.path("percentage").asDouble(0)));
                        quickSummary.put("questions_attempted", summary.path("questions_attempted").asInt(0));
                        quickSummary.put("questions_total", summary.path("questions_attempted").asInt(0));
                }

                JsonNode session = raw.get("session");
                if (session != null) {
                        quickSummary.put("time_used_seconds", session.path("duration_seconds").asLong(0));
                        quickSummary.put("time_allowed_seconds", 0);
                }

                stats.set("quick_summary", quickSummary);
                stats.set("section_scores", objectMapper.createArrayNode());
                stats.set("difficulty_breakdown", objectMapper.createObjectNode());

                // Time analysis from questions if available
                List<Long> times = new ArrayList<>();
                JsonNode questions = raw.get("questions");
                if (questions != null && questions.isArray()) {
                        for (JsonNode q : questions) {
                                long time = q.path("time_taken_seconds").asLong(0);
                                if (time > 0) times.add(time);
                        }
                }
                computeTimeAnalysis(times, stats);
        }

        private void computeQuestionStats(JsonNode raw, ObjectNode stats) {
                ObjectNode quickSummary = objectMapper.createObjectNode();
                JsonNode question = raw.get("question");
                if (question != null) {
                        quickSummary.put("max_score", question.path("points").asDouble(0));
                }

                int totalAttempts = raw.path("total_attempts").asInt(0);
                quickSummary.put("questions_attempted", totalAttempts > 0 ? 1 : 0);
                quickSummary.put("questions_total", 1);

                // Get best marks from attempts
                double bestMarks = 0;
                JsonNode attempts = raw.get("attempts");
                if (attempts != null && attempts.isArray()) {
                        for (JsonNode a : attempts) {
                                double marks = a.path("marks").asDouble(0);
                                if (marks > bestMarks) bestMarks = marks;
                        }
                }
                quickSummary.put("total_score", bestMarks);
                double maxScore = quickSummary.path("max_score").asDouble(0);
                quickSummary.put("accuracy_pct", maxScore > 0 ? Math.round(bestMarks * 100.0 / maxScore) : 0);
                quickSummary.put("time_used_seconds", 0);
                quickSummary.put("time_allowed_seconds", 0);

                stats.set("quick_summary", quickSummary);
                stats.set("section_scores", objectMapper.createArrayNode());
                stats.set("difficulty_breakdown", objectMapper.createObjectNode());
                stats.set("time_analysis", objectMapper.createObjectNode());
        }

        private void computeGenericStats(JsonNode raw, ObjectNode stats) {
                stats.set("quick_summary", objectMapper.createObjectNode());
                stats.set("section_scores", objectMapper.createArrayNode());
                stats.set("difficulty_breakdown", objectMapper.createObjectNode());
                stats.set("time_analysis", objectMapper.createObjectNode());
        }

        private void computeTimeAnalysis(List<Long> timesPerQuestion, ObjectNode stats) {
                ObjectNode timeAnalysis = objectMapper.createObjectNode();
                if (timesPerQuestion.isEmpty()) {
                        stats.set("time_analysis", timeAnalysis);
                        return;
                }

                long sum = 0, min = Long.MAX_VALUE, max = 0;
                for (long t : timesPerQuestion) {
                        sum += t;
                        if (t < min) min = t;
                        if (t > max) max = t;
                }
                long avg = sum / timesPerQuestion.size();

                int rushedCount = 0;
                int overtimeCount = 0;
                for (long t : timesPerQuestion) {
                        if (t < 15) rushedCount++;
                        if (t > avg * 2) overtimeCount++;
                }

                timeAnalysis.put("avg_time_per_question_seconds", avg);
                timeAnalysis.put("fastest_question_seconds", min);
                timeAnalysis.put("slowest_question_seconds", max);
                timeAnalysis.put("rushed_count", rushedCount);
                timeAnalysis.put("overtime_count", overtimeCount);
                stats.set("time_analysis", timeAnalysis);
        }

        /**
         * Check if a student has actually responded to a question.
         * In enriched assessment data, studentResponse is a JSON string of the response object.
         */
        private boolean hasStudentResponse(JsonNode question) {
                // Check selectedOptionIds first (MCQ responses)
                JsonNode optionIds = question.get("selectedOptionIds");
                if (optionIds != null && optionIds.isArray() && optionIds.size() > 0) {
                        return true;
                }
                // Check studentAnswer (subjective responses)
                String studentAnswer = question.path("studentAnswer").asText("");
                if (!studentAnswer.isEmpty()) {
                        return true;
                }
                // Check studentResponse string (raw JSON string of response data)
                String studentResponse = question.path("studentResponse").asText("");
                if (!studentResponse.isEmpty() && !studentResponse.equals("null") && !studentResponse.equals("{}")) {
                        // Parse to check if it actually has meaningful content
                        try {
                                JsonNode responseNode = objectMapper.readTree(studentResponse);
                                if (responseNode.has("optionIds")) {
                                        JsonNode ids = responseNode.get("optionIds");
                                        return ids.isArray() && ids.size() > 0;
                                }
                                if (responseNode.has("answer")) {
                                        String ans = responseNode.path("answer").asText("");
                                        return !ans.isEmpty();
                                }
                                // Has some response data
                                return responseNode.size() > 0;
                        } catch (Exception e) {
                                return !studentResponse.trim().isEmpty();
                        }
                }
                // Check isVisited as last resort
                return false;
        }

        /**
         * Determine if the student's answer is correct by comparing selected options
         * with correct options from autoEvaluationJson.
         */
        private boolean determineCorrectness(JsonNode question) {
                // autoEvaluationJson in enriched data is a raw JSON string, not an object
                String autoEvalStr = question.path("autoEvaluationJson").asText("");
                JsonNode autoEval = null;
                if (!autoEvalStr.isEmpty() && !autoEvalStr.equals("null")) {
                        try {
                                autoEval = objectMapper.readTree(autoEvalStr);
                        } catch (Exception e) {
                                // Also handle case where it's already an object node
                                JsonNode directNode = question.get("autoEvaluationJson");
                                if (directNode != null && directNode.isObject()) {
                                        autoEval = directNode;
                                }
                        }
                } else {
                        // Handle case where it's already parsed as an object
                        JsonNode directNode = question.get("autoEvaluationJson");
                        if (directNode != null && directNode.isObject()) {
                                autoEval = directNode;
                        }
                }

                if (autoEval == null) return false;

                // For MCQ: compare selectedOptionIds with correctOptionIds from autoEval
                // Structure can be: {"type":"MCQS","data":{"correctOptionIds":[...]}}
                // or flat: {"correct_option_ids":[...]} or {"correctOptionIds":[...]}
                JsonNode correctOptionIds = findCorrectOptionIds(autoEval);
                if (correctOptionIds != null && correctOptionIds.isArray() && correctOptionIds.size() > 0) {
                        // Get student's selected options
                        JsonNode selectedIds = question.get("selectedOptionIds");
                        if (selectedIds == null || !selectedIds.isArray()) {
                                // Try parsing from studentResponse string
                                String studentResponse = question.path("studentResponse").asText("");
                                if (!studentResponse.isEmpty() && !studentResponse.equals("null")) {
                                        try {
                                                JsonNode responseNode = objectMapper.readTree(studentResponse);
                                                selectedIds = responseNode.get("optionIds");
                                        } catch (Exception e) {
                                                return false;
                                        }
                                }
                        }
                        if (selectedIds == null || !selectedIds.isArray()) return false;

                        // Compare sets of option IDs
                        java.util.Set<String> correct = new java.util.HashSet<>();
                        correctOptionIds.forEach(n -> correct.add(n.asText()));
                        java.util.Set<String> selected = new java.util.HashSet<>();
                        selectedIds.forEach(n -> selected.add(n.asText()));
                        return correct.equals(selected);
                }

                // For subjective: check if autoEval has marks > 0
                if (autoEval.has("marks") && autoEval.get("marks").asDouble(0) > 0) {
                        return true;
                }

                return false;
        }

        /**
         * Find correctOptionIds from autoEvaluationJson which can have multiple structures:
         * - {"type":"MCQS","data":{"correctOptionIds":[...]}}
         * - {"correctOptionIds":[...]}
         * - {"correct_option_ids":[...]}
         */
        private JsonNode findCorrectOptionIds(JsonNode autoEval) {
                // Check nested: data.correctOptionIds (actual format from assessment_service)
                JsonNode nested = autoEval.path("data").path("correctOptionIds");
                if (nested.isArray() && nested.size() > 0) return nested;

                // Check flat camelCase: correctOptionIds
                JsonNode flat = autoEval.path("correctOptionIds");
                if (flat.isArray() && flat.size() > 0) return flat;

                // Check flat snake_case: correct_option_ids
                JsonNode snake = autoEval.path("correct_option_ids");
                if (snake.isArray() && snake.size() > 0) return snake;

                return null;
        }

        private String createStudentAnalysisPrompt(String rawJson, String activityType, ObjectNode preComputedStats) {
                String statsJson;
                try {
                        statsJson = objectMapper.writeValueAsString(preComputedStats);
                } catch (Exception e) {
                        statsJson = "{}";
                }

                return """
                                Analyze this student submission data and return insights as JSON.

                                Activity Type: %s

                                PRE-COMPUTED STATS (verified, reference these in your analysis):
                                %s

                                STUDENT SUBMISSION DATA:
                                %s

                                Return this exact JSON structure:
                                {
                                  "performance_band": "excellent|good|average|needs_work",
                                  "encouragement": "One motivational sentence tailored to this student's performance",
                                  "performance_analysis": "Markdown analysis with separate paragraphs for strengths and weaknesses",
                                  "strengths": {"topic_name": score_0_to_100},
                                  "weaknesses": {"topic_name": score_0_to_100},
                                  "conceptual_gaps": [
                                    {"concept": "specific concept name", "evidence": "what the student got wrong", "suggestion": "how to improve"}
                                  ],
                                  "improvement_path": "Markdown numbered list study plan",
                                  "flashcards": [{"front": "concept/question", "back": "clear explanation"}]
                                }

                                Rules:
                                - performance_band: "excellent" if accuracy>=85%%, "good" if >=70%%, "average" if >=50%%, "needs_work" otherwise
                                - strengths/weaknesses: use topic names from the questions, max 5 each, score 0-100
                                - conceptual_gaps: 2-4 items with evidence from actual questions the student answered incorrectly
                                - flashcards: 3-7 cards focusing on concepts the student got wrong
                                - performance_analysis: Write 2-3 short paragraphs. Use double newlines between paragraphs. First paragraph about strengths, second about weaknesses, third about overall patterns.
                                - improvement_path: Write as a markdown numbered list. Each step on its own line. Use "1. ", "2. ", etc. with double newlines between steps. Include specific topics and practice recommendations.
                                - encouragement: positive but honest, acknowledge what went well
                                - IMPORTANT: For all markdown text fields, use actual newline characters (not literal backslash-n). Use double newlines to separate paragraphs and list items.
                                - Base analysis on student responses, auto-evaluation data, and correct answers
                                - DO NOT rely on "is_correct" boolean flags, compare responses with correct answers instead
                                - Return ONLY valid JSON
                                """
                                .formatted(activityType, statsJson, rawJson);
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
