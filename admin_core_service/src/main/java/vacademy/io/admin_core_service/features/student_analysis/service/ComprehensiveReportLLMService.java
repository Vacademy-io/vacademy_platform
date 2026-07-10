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
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.NarrativeSection;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.SubjectMarksSection;
import vacademy.io.admin_core_service.features.student_analysis.service.aggregation.SubjectResolver;

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
    // Narration asks for a large JSON (all insights + 6 rich-markdown narrative fields). On slow
    // free-tier OpenRouter models this routinely exceeds a tight timeout, causing the whole
    // ai_insights (and narrative) to fall back to deterministic text. This is a background @Async
    // job with no user waiting synchronously, so a generous per-request timeout is safe.
    private static final int RESPONSE_TIMEOUT_SECONDS = 170;
    private static final int MAX_RETRIES_PER_MODEL = 2;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final AIModelRegistryService aiModelRegistryService;
    private final AiTokenUsageService aiTokenUsageService;
    private final SubjectResolver subjectResolver;

    public ComprehensiveReportLLMService(
            @Value("${openrouter.api.key}") String apiKey,
            ObjectMapper objectMapper,
            AIModelRegistryService aiModelRegistryService,
            AiTokenUsageService aiTokenUsageService,
            SubjectResolver subjectResolver) {
        this.objectMapper = objectMapper;
        this.aiModelRegistryService = aiModelRegistryService;
        this.aiTokenUsageService = aiTokenUsageService;
        this.subjectResolver = subjectResolver;
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

    /**
     * ADDITIVE: clusters raw graded items (assessments/assignments/quiz/question marks) into
     * subject domains by topic, e.g. "optics quiz", "magnetism" → Physics. Best-effort — the
     * caller ({@code SubjectMarksCollector#deterministicGroup} via {@code StudentAnalysisProcessorService})
     * MUST fall back to deterministic DB-subject-hint grouping on empty/error, since this
     * codebase has learned the LLM can be unreliable (§ design doc constraint).
     *
     * <p>STRICT: the model must not invent marks — it only sums the numbers it is given.
     * Percentage is always recomputed in Java from the returned marks, never trusted from the LLM.
     */
    public Mono<List<SubjectMarksSection.SubjectMarks>> clusterSubjectMarks(
            List<SubjectMarksSection.GradedItem> items, String userId) {
        if (items == null || items.isEmpty()) {
            return Mono.just(List.of());
        }
        log.info("[ComprehensiveReportLLM] Clustering {} graded items into subjects for userId={}", items.size(), userId);

        List<String> modelPriority = aiModelRegistryService.getModelPriority("student_report");
        if (modelPriority == null || modelPriority.isEmpty()) {
            modelPriority = aiModelRegistryService.getModelPriority("analytics");
        }
        if (modelPriority == null || modelPriority.isEmpty()) {
            log.error("[ComprehensiveReportLLM] No AI models available for subject-marks clustering");
            return Mono.error(new RuntimeException("No AI models available for subject-marks clustering"));
        }

        String prompt = buildSubjectMarksPrompt(items);
        return trySubjectMarksModelsWithFallback(prompt, modelPriority, 0, userId);
    }

    private Mono<List<SubjectMarksSection.SubjectMarks>> trySubjectMarksModelsWithFallback(
            String prompt, List<String> models, int idx, String userId) {
        if (idx >= models.size()) {
            return Mono.error(new RuntimeException("All LLM models failed for subject-marks clustering. Tried: " + models));
        }
        String model = models.get(idx);
        return generateSubjectMarksWithModel(prompt, model, userId)
                .retryWhen(Retry.fixedDelay(MAX_RETRIES_PER_MODEL, Duration.ofSeconds(2))
                        .doBeforeRetry(s -> log.warn("[ComprehensiveReportLLM] Subject-marks retry {}/{} for model={}",
                                s.totalRetries() + 1, MAX_RETRIES_PER_MODEL, model))
                        .onRetryExhaustedThrow((spec, signal) -> signal.failure()))
                .onErrorResume(err -> {
                    log.error("[ComprehensiveReportLLM] Subject-marks model {} failed: {}. Trying next.", model, err.getMessage());
                    return trySubjectMarksModelsWithFallback(prompt, models, idx + 1, userId);
                });
    }

    private Mono<List<SubjectMarksSection.SubjectMarks>> generateSubjectMarksWithModel(
            String prompt, String model, String userId) {
        Map<String, Object> payload = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content",
                                "You are an expert academic taxonomist. You cluster graded item titles into "
                                + "subject domains (e.g. Physics, Mathematics, Chemistry, Biology, English). "
                                + "You MUST NOT invent, estimate, or alter any marks — only sum the numbers "
                                + "you are given, grouped by the subject domain you infer."),
                        Map.of("role", "user", "content", prompt)),
                "response_format", Map.of("type", "json_object"));

        return webClient.post()
                .uri("/api/v1/chat/completions")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                .doOnNext(response -> logTokenUsage(response, model, userId))
                .flatMap(response -> parseSubjectMarks(response, model));
    }

    private Mono<List<SubjectMarksSection.SubjectMarks>> parseSubjectMarks(String body, String model) {
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
            JsonNode subjectsNode = parsed.path("subjects");
            List<SubjectMarksSection.SubjectMarks> result = new ArrayList<>();
            if (subjectsNode.isArray()) {
                for (JsonNode s : subjectsNode) {
                    String subject = s.path("subject").asText(null);
                    // Drop null/blank AND placeholder subjects ("Other"/"Unknown"/…) — we never
                    // surface a catch-all bucket to a parent.
                    if (subject == null || subject.isBlank() || subjectResolver.isPlaceholder(subject)) continue;
                    Double obtained = s.has("marks_obtained") && !s.get("marks_obtained").isNull()
                            ? s.get("marks_obtained").asDouble() : null;
                    Double total = s.has("total_marks") && !s.get("total_marks").isNull()
                            ? s.get("total_marks").asDouble() : null;
                    // Percentage is ALWAYS recomputed here — never trust LLM math.
                    Double pct = (obtained != null && total != null && total > 0)
                            ? Math.round((obtained / total * 100.0) * 10.0) / 10.0 : null;
                    List<String> topics = parseStringList(s.path("topics"));

                    result.add(SubjectMarksSection.SubjectMarks.builder()
                            .subject(subject)
                            .marksObtained(obtained)
                            .totalMarks(total)
                            .percentage(pct)
                            .itemCount(topics.size())
                            .topics(topics)
                            .build());
                }
            }
            log.info("[ComprehensiveReportLLM] Subject-marks clustering succeeded with model={} ({} subjects)", model, result.size());
            return Mono.just(result);

        } catch (Exception e) {
            log.error("[ComprehensiveReportLLM] Failed to parse subject-marks clustering from model={}: {}", model, e.getMessage());
            return Mono.error(new RuntimeException("Failed to parse subject-marks clustering: " + e.getMessage(), e));
        }
    }

    private String buildSubjectMarksPrompt(List<SubjectMarksSection.GradedItem> items) {
        try {
            String itemsJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(items);
            return """
                    You are given a list of graded items a student completed (assessments, assignments,
                    quizzes, and individual questions), each with a title, an optional subject hint from
                    our database, marks obtained, and total marks.

                    YOUR TASK: cluster these items into subject domains by inferring the academic subject
                    from the title (use the provided "subject" hint when present and trust it; when absent
                    or ambiguous, infer the domain from the title — e.g. "optics quiz", "magnetism",
                    "Newton's law" → Physics; "algebra", "polynomials" → Math), then SUM the marks_obtained
                    and total_marks of every item assigned to that subject.

                    STRICT RULES:
                    1. Do NOT invent, estimate, or alter any marks. Only sum the exact numbers given per item.
                    2. Use clean, human-readable subject names (e.g. "Physics", "Mathematics", "Chemistry",
                       "Biology", "English", "Science", "Social Studies").
                    3. If — and only if — you genuinely cannot infer a subject for an item from its title or
                       hint, OMIT that item entirely. NEVER invent a catch-all bucket: do NOT output
                       "Other", "Unknown", "General", "Misc", or similar. It is better to drop an item than
                       to mislabel it. (Its marks still count elsewhere in the report.)
                    4. "topics" for each subject is the list of item titles clustered into it.

                    Return ONLY a valid JSON object with this exact structure (no extra keys):
                    {
                      "subjects": [
                        { "subject": "Physics", "marks_obtained": 30, "total_marks": 60, "topics": ["Optics Quiz", "Magnetism Test"] }
                      ]
                    }

                    GRADED ITEMS:
                    """ + itemsJson;
        } catch (Exception e) {
            log.error("[ComprehensiveReportLLM] Failed to build subject-marks prompt: {}", e.getMessage());
            return "Cluster the following graded items by subject and sum their marks. Return JSON with key: subjects.";
        }
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
                    .narrative(parseNarrative(parsed.path("narrative")))
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
                    .subjectMarks(facts.getSubjectMarks())
                    .doubtsAndEngagement(facts.getDoubtsAndEngagement())
                    // Learning insights (topic mastery / Bloom's / confidence / misconceptions)
                    // parsed from processed_json — the rich texture that made v1's analysis deep.
                    .learningInsights(facts.getLearningInsights())
                    .strengths(facts.getStrengths())
                    .areasToImprove(facts.getAreasToImprove())
                    .build();

            String factsJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(factsOnly);

            return """
                    You are given the verified, deterministic student report data below (Layer-1 facts),
                    including a "learning_insights" block (topic mastery, Bloom's thinking-skill levels,
                    confidence, and specific misconceptions) parsed from the learner's recent attempts.

                    YOUR TASK: generate ONE JSON object containing BOTH the "ai_insights" fields AND a rich
                    "narrative" object (a deep, parent-readable written analysis). Use the learning_insights
                    heavily — that is where the real texture is.

                    STRICT RULES:
                    1. You MUST NOT introduce any new numbers, percentages, dates, or counts not present in the facts.
                    2. You ONLY interpret, correlate, and explain what you see — but you MUST use ALL of the data below,
                       especially learning_insights (weak topics, confidently-wrong answers, and misconceptions).
                    3. STRENGTHS and WEAKNESSES — derive these from EVERY available domain, not just assessments:
                       - learning_insights.topic_mastery (topic + accuracy + mastery_level): Expert/Proficient → strength, Developing/Beginner → weakness.
                       - course_progress.subjects (subject + completion_percentage): high completion → strength, low → weakness.
                       - academics.subject_performance (subject + score_percentage): high score → strength, low → weakness.
                       - Also consider assignments (submitted/on-time/avg score), attendance %, live-class attendance,
                         and study consistency as strengths/weaknesses where clearly good or poor.
                       The map value is a 0-100 confidence: use the topic's own accuracy / completion_percentage / score_percentage
                       when available, otherwise your best qualitative rating consistent with the facts.
                       Classification: strength if the value is >= 60, weakness/area-to-improve if < 60.
                       Aim for 3-6 strengths and 2-6 areas to improve whenever the data supports it, and ALWAYS return at
                       least one of each when any subject/topic data exists. Use the real subject/topic names from the facts
                       (never invent topics that aren't present).
                    4. "summary" is a one-sentence AI summary shown inside the ai_insights card.
                    5. "parent_summary" is a jargon-free 2-4 sentence paragraph written for a parent — highlight achievements and one clear focus area.
                    6. "overview_one_line" is a ≤15-word headline shown under the student's name on the report cover.
                    7. "cross_domain_insights" is an array of 2-5 observations that connect two or more sections (e.g., attendance vs marks, confidence vs accuracy, progress vs assignments).
                    8. "recommendations" is the IMPROVEMENT PATH: 3-5 concrete, actionable, prioritized (HIGH/MEDIUM/LOW) steps.
                       Each must name the specific area it addresses (a weak topic/subject, a misconception, low attendance, pending assignments, etc.)
                       and a clear action the student/parent can take. Always produce at least 3 when any weakness or gap exists.
                    9. "section_commentary" is optional; include only for sections where you have a genuine observation.
                    10. "narrative" is a deep written analysis in RICH MARKDOWN (the parent-facing detail view). Each field:
                        - Use `###` sub-headers and put a blank line (\\n\\n) before every header, table, and list so it renders cleanly.
                        - Use Markdown tables to compare data and **bold** for key metrics; keep it readable, not a wall of text.
                        - Ground every claim in the facts above; do NOT invent numbers.
                        Fields:
                        - "learning_frequency": consistency & gaps in engagement (use study_habits / login facts).
                        - "progress": overall trajectory; frame as previous-vs-current where trend data exists.
                        - "student_efforts": effort vs output (time spent vs accuracy/completion). Include a small table.
                        - "topics_of_improvement": topics trending up (from topic_mastery / subject_performance). Bullet list.
                        - "topics_of_degradation": topics needing attention (weak mastery, misconceptions, confidently-wrong). Bullet list with ⚠️.
                        - "remedial_points": a concrete `- [ ]` action checklist (5-10 items) tied to the weak areas and misconceptions.

                    Return ONLY a valid JSON object with this exact structure (no extra keys):
                    {
                      "summary": "...",
                      "parent_summary": "...",
                      "overview_one_line": "...",
                      "cross_domain_insights": ["...", "..."],
                      "strengths": { "Subject/Topic": 85 },
                      "weaknesses": { "Subject/Topic": 40 },
                      "recommendations": [{ "priority": "HIGH", "area": "...", "suggestion": "..." }],
                      "section_commentary": { "attendance": "...", "academics": "..." },
                      "narrative": {
                        "learning_frequency": "### ... rich markdown ...",
                        "progress": "### ... rich markdown ...",
                        "student_efforts": "### ... rich markdown ...",
                        "topics_of_improvement": "### ... rich markdown ...",
                        "topics_of_degradation": "### ... rich markdown ...",
                        "remedial_points": "### ... rich markdown checklist ..."
                      }
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

    /**
     * Parses the v1-style rich-Markdown "narrative" object. Returns null when the model omitted it
     * or every field is blank, so the processor/UI simply skip the "Detailed analysis" panel.
     */
    private NarrativeSection parseNarrative(JsonNode node) {
        if (node == null || !node.isObject()) return null;
        NarrativeSection narrative = NarrativeSection.builder()
                .learningFrequency(textOrNull(node, "learning_frequency"))
                .progress(textOrNull(node, "progress"))
                .studentEfforts(textOrNull(node, "student_efforts"))
                .topicsOfImprovement(textOrNull(node, "topics_of_improvement"))
                .topicsOfDegradation(textOrNull(node, "topics_of_degradation"))
                .remedialPoints(textOrNull(node, "remedial_points"))
                .build();
        boolean anyContent = narrative.getLearningFrequency() != null || narrative.getProgress() != null
                || narrative.getStudentEfforts() != null || narrative.getTopicsOfImprovement() != null
                || narrative.getTopicsOfDegradation() != null || narrative.getRemedialPoints() != null;
        return anyContent ? narrative : null;
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (v.isMissingNode() || v.isNull()) return null;
        String s = v.asText();
        return (s == null || s.isBlank()) ? null : s;
    }
}
