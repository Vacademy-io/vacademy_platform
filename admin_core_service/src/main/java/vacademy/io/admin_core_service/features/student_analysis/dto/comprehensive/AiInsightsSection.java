package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Layer-2 AI narrative — interpretation only, no new numbers.
 * Returned by {@code ComprehensiveReportLLMService.narrate()}.
 *
 * <p>{@code parentSummary} and {@code overviewOneLine} are parsed here and then
 * lifted to the top level of {@link ComprehensiveStudentReport} by the processor.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AiInsightsSection {

    /** Parent-friendly one-paragraph summary — serialized as "summary". */
    private String summary;

    /** Cross-domain observations (attendance+marks, focus+activity, etc.). */
    private List<String> crossDomainInsights;

    /** Prioritised action recommendations. */
    private List<RecommendationItem> recommendations;

    /**
     * Optional per-section commentary keyed by section name
     * (e.g. "attendance", "academics", "study_habits").
     */
    private Map<String, String> sectionCommentary;

    // ── Fields lifted to report top-level after narration; hidden from ai_insights JSON ──

    /**
     * LLM-generated parent-facing summary paragraph.
     * After narration, the processor moves this to {@code ComprehensiveStudentReport.parentSummary}.
     * Not serialized inside {@code ai_insights}.
     */
    @JsonIgnore
    private String parentSummary;

    /**
     * LLM-generated one-line overview.
     * After narration, the processor moves this to {@code OverviewSection.oneLine}.
     * Not serialized inside {@code ai_insights}.
     */
    @JsonIgnore
    private String overviewOneLine;

    /**
     * Raw strengths map from LLM (topic → confidence).
     * Stored internally for updateUserLinkedData; NOT serialized in ai_insights output
     * (strengths appear at top-level as {@code strengths[]}).
     */
    @JsonIgnore
    private Map<String, Integer> strengthsMap;

    /**
     * Raw weaknesses map from LLM (topic → confidence).
     * Stored internally; NOT serialized in ai_insights output
     * (areas_to_improve appears at top-level).
     */
    @JsonIgnore
    private Map<String, Integer> weaknessesMap;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RecommendationItem {
        private String priority;   // HIGH / MEDIUM / LOW
        private String area;
        private String suggestion;
    }
}
