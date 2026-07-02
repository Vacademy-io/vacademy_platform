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
import vacademy.io.admin_core_service.features.ai_models.service.AIModelRegistryService;
import vacademy.io.admin_core_service.features.ai_usage.enums.ApiProvider;
import vacademy.io.admin_core_service.features.ai_usage.enums.RequestType;
import vacademy.io.admin_core_service.features.ai_usage.service.AiTokenUsageService;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AiInsightsSection;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.ComprehensiveStudentReport;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Layer-2 AI narrative service for the v2 comprehensive student report.
 *
 * <p><strong>Isolation rules (§13 of design doc):</strong>
 * <ul>
 *   <li>This is a NEW class. The v1 {@link StudentReportLLMService} is untouched.</li>
 *   <li>Model key: tries {@code "student_report"} first; falls back to {@code "analytics"}
 *       read-only. The {@code "analytics"} registry entry is NEVER mutated here.</li>
 *   <li>Prompt instructs the model NOT to emit numeric claims beyond what Layer-1 supplied.</li>
 * </ul>
 */
@Slf4j
@Service
public class ComprehensiveReportLLMService {

    private static final String API_URL = "https://openrouter.ai";
    private static final int RESPONSE_TIMEOUT_SECONDS = 90;
    private static final int MAX_RETRIES_PER_MODEL = 2;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final AIModelRegistryService aiModelRegistryService;
    private final AiTokenUsageService aiTokenUsageService;

    public ComprehensiveReportLLMService(
            @Value("${openrouter.api.key}") String apiKey,
            ObjectMapper objectMapper,
            AIModelRegistryService aiModelRegistryService,
            AiTokenUsageService aiTokenUsageService) {
        this.objectMapper = objectMapper;
        this.aiModelRegistryService = aiModelRegistryService;
        this.aiTokenUsageService = aiTokenUsageService;
        this.webClient = WebClient.builder()
                .baseUrl(API_URL)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Generates the ai_insights section from the assembled Layer-1 facts.
     * Returns {@code null} on complete failure so the processor can still persist
     * the deterministic section without blocking.
     */
    public Mono<AiInsightsSection> narrate(ComprehensiveStudentReport facts, String userId) {
        log.info("[ComprehensiveReportLLM] Generating ai_insights for userId={}", userId);

        // §13.2 rule: try dedicated key first, fall back to "analytics" read-only
        List<String> modelPriority = aiModelRegistryService.getModelPriority("student_report");
        if (modelPriority == null || modelPriority.isEmpty()) {
            log.info("[ComprehensiveReportLLM] 'student_report' model key not configured, falling back to 'analytics'");
            modelPriority = aiModelRegistryService.getModelPriority("analytics");
        }
        if (modelPriority == null || modelPriority.isEmpty()) {
            log.error("[ComprehensiveReportLLM] No AI models available for student_report narration");
            return Mono.error(new RuntimeException("No AI models available for student_report narration"));
        }

        String prompt = buildPrompt(facts);
        return tryModelsWithFallback(prompt, modelPriority, 0, userId);
    }

    // ── model retry / fallback ────────────────────────────────────────────────

    private Mono<AiInsightsSection> tryModelsWithFallback(
            String prompt, List<String> models, int idx, String userId) {
        if (idx >= models.size()) {
            return Mono.error(new RuntimeException("All LLM models failed for student_report. Tried: " + models));
        }
        String model = models.get(idx);
        return generateWithModel(prompt, model, userId)
                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2))
                        .doBeforeRetry(s -> log.warn("[ComprehensiveReportLLM] Retry {}/{} for model={}",
                                s.totalRetries() + 1, MAX_RETRIES_PER_MODEL, model))
                        .onRetryExhaustedThrow((spec, signal) -> signal.failure()))
                .onErrorResume(err -> {
                    log.error("[ComprehensiveReportLLM] Model {} failed: {}. Trying next.", model, err.getMessage());
                    return tryModelsWithFallback(prompt, models, idx + 1, userId);
                });
    }

    private Mono<AiInsightsSection> generateWithModel(String prompt, String model, String userId) {
        Map<String, Object> payload = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content",
                                "You are an expert educational analyst writing parent-facing student report narratives. "
                                + "You ONLY interpret the data you are given. You MUST NOT invent, estimate, or add "
                                + "any numeric claims (percentages, scores, dates, counts) that are not present in "
                                + "the provided facts. Your role is interpretation and insight only."),
                        Map.of("role", "user", "content", prompt)),
                "response_format", Map.of("type", "json_object"));

        return webClient.post()
                .uri("/api/v1/chat/completions")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                .doOnNext(response -> logTokenUsage(response, model, userId))
                .flatMap(response -> parseInsights(response, model));
    }

    private void logTokenUsage(String body, String model, String userId) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode usage = root.get("usage");
            if (usage != null) {
                int prompt = usage.has("prompt_tokens") ? usage.get("prompt_tokens").asInt() : 0;
                int completion = usage.has("completion_tokens") ? usage.get("completion_tokens").asInt() : 0;
                UUID userUuid = null;
                try { if (userId != null) userUuid = UUID.fromString(userId); } catch (IllegalArgumentException ignored) {}
                aiTokenUsageService.recordUsageAsync(ApiProvider.OPENAI, RequestType.ANALYTICS, model, prompt, completion, null, userUuid);
            }
        } catch (Exception e) {
            log.warn("[ComprehensiveReportLLM] Token usage logging failed: {}", e.getMessage());
        }
    }

    private Mono<AiInsightsSection> parseInsights(String body, String model) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            if (contentNode.isMissingNode()) {
                return Mono.error(new RuntimeException("No content in LLM response"));
            }
            String content = contentNode.asText();
            if (content.startsWith("```json")) content = content.replace("```json", "").replace("```", "").trim();
            else if (content.startsWith("```")) content = content.replace("```", "").trim();

            JsonNode parsed = objectMapper.readTree(content);

            AiInsightsSection insights = AiInsightsSection.builder()
                    .summary(parsed.path("summary").asText(null))
                    .crossDomainInsights(parseStringList(parsed.path("cross_domain_insights")))
                    .strengthsMap(parseTopicMap(parsed.path("strengths")))
                    .weaknessesMap(parseTopicMap(parsed.path("weaknesses")))
                    .recommendations(parseRecommendations(parsed.path("recommendations")))
                    .sectionCommentary(parseSectionCommentary(parsed.path("section_commentary")))
                    .parentSummary(parsed.path("parent_summary").asText(null))
                    .overviewOneLine(parsed.path("overview_one_line").asText(null))
                    .build();

            log.info("[ComprehensiveReportLLM] Successfully generated ai_insights with model={}", model);
            return Mono.just(insights);

        } catch (Exception e) {
            log.error("[ComprehensiveReportLLM] Failed to parse ai_insights from model={}: {}", model, e.getMessage());
            return Mono.error(new RuntimeException("Failed to parse ai_insights: " + e.getMessage(), e));
        }
    }

    // ── prompt builder ────────────────────────────────────────────────────────

    private String buildPrompt(ComprehensiveStudentReport facts) {
        try {
            // Serialize the Layer-1 facts (without ai_insights) to pass to the model.
            // Include all serializable sections; @JsonIgnore fields are excluded automatically.
            ComprehensiveStudentReport factsOnly = ComprehensiveStudentReport.builder()
                    .meta(facts.getMeta())
                    .student(facts.getStudent())
                    .institute(facts.getInstitute())
                    .period(facts.getPeriod())
                    .overview(facts.getOverview())
                    .attendance(facts.getAttendance())
                    .academics(facts.getAcademics())
                    .studyHabits(facts.getStudyHabits())
                    .courseProgress(facts.getCourseProgress())
                    .liveClasses(facts.getLiveClasses())
                    .achievements(facts.getAchievements())
                    .assignments(facts.getAssignments())
                    .doubtsAndEngagement(facts.getDoubtsAndEngagement())
                    .strengths(facts.getStrengths())
                    .areasToImprove(facts.getAreasToImprove())
                    .build();

            String factsJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(factsOnly);

            return """
                    You are given the verified, deterministic student report data below (Layer-1 facts).

                    YOUR TASK: generate ONLY the "ai_insights" JSON object (not the full report).

                    STRICT RULES:
                    1. You MUST NOT introduce any new numbers, percentages, dates, or counts not present in the facts.
                    2. You ONLY interpret, correlate, and explain what you see.
                    3. Strengths: topics with score 70-100. Weaknesses: topics with score 0-50. Only infer from assessments data if available.
                    4. "summary" is a one-sentence AI summary shown inside the ai_insights card.
                    5. "parent_summary" is a jargon-free 2-4 sentence paragraph written for a parent — highlight achievements and one clear focus area.
                    6. "overview_one_line" is a ≤15-word headline shown under the student's name on the report cover.
                    7. "cross_domain_insights" is an array of 2-5 observations that connect two or more sections (e.g., attendance vs marks).
                    8. "recommendations" must be actionable and prioritized (HIGH/MEDIUM/LOW).
                    9. "section_commentary" is optional; include only for sections where you have a genuine observation.

                    Return ONLY a valid JSON object with this exact structure (no extra keys):
                    {
                      "summary": "...",
                      "parent_summary": "...",
                      "overview_one_line": "...",
                      "cross_domain_insights": ["...", "..."],
                      "strengths": { "Topic": 85 },
                      "weaknesses": { "Topic": 40 },
                      "recommendations": [{ "priority": "HIGH", "area": "...", "suggestion": "..." }],
                      "section_commentary": { "attendance": "...", "academics": "..." }
                    }

                    STUDENT REPORT FACTS:
                    """ + factsJson;

        } catch (Exception e) {
            log.error("[ComprehensiveReportLLM] Failed to build prompt: {}", e.getMessage());
            return "Generate a student performance summary. Return JSON with keys: summary, cross_domain_insights, strengths, weaknesses, recommendations, section_commentary.";
        }
    }

    // ── parsers ───────────────────────────────────────────────────────────────

    private List<String> parseStringList(JsonNode node) {
        List<String> list = new ArrayList<>();
        if (node.isArray()) {
            node.forEach(n -> list.add(n.asText()));
        }
        return list;
    }

    private Map<String, Integer> parseTopicMap(JsonNode node) {
        Map<String, Integer> map = new HashMap<>();
        if (node.isObject()) {
            node.fields().forEachRemaining(e -> map.put(e.getKey(), e.getValue().asInt()));
        }
        return map;
    }

    private List<AiInsightsSection.RecommendationItem> parseRecommendations(JsonNode node) {
        List<AiInsightsSection.RecommendationItem> recs = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode r : node) {
                recs.add(AiInsightsSection.RecommendationItem.builder()
                        .priority(r.path("priority").asText("MEDIUM"))
                        .area(r.path("area").asText(null))
                        .suggestion(r.path("suggestion").asText(null))
                        .build());
            }
        }
        return recs;
    }

    private Map<String, String> parseSectionCommentary(JsonNode node) {
        Map<String, String> map = new HashMap<>();
        if (node.isObject()) {
            node.fields().forEachRemaining(e -> map.put(e.getKey(), e.getValue().asText()));
        }
        return map;
    }
}
