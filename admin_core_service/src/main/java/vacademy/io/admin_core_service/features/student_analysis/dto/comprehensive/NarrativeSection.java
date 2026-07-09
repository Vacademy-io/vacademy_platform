package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * v2 comprehensive report ADDITIVE section: "Detailed analysis" — serialized as {@code narrative}.
 *
 * <p>This restores v1's deep, rich-Markdown narrative into the v2 report so the combined report has
 * BOTH the graphs/stats (v2) AND the qualitative depth (v1). Produced by the SAME Layer-2 LLM call
 * that generates {@code ai_insights} (one cohesive call, not a second round-trip), grounded in the
 * deterministic facts + {@link LearningInsightsSection}. Rendered in an expandable "Detailed
 * analysis" panel on the frontend (react-markdown / GFM).
 *
 * <p>All fields are optional Markdown; any that the model omits stay null and the UI hides them.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class NarrativeSection {

    /** How regularly/consistently the learner engaged (patterns, gaps). */
    private String learningFrequency;

    /** Overall progress narrative, ideally with previous-vs-current framing. */
    private String progress;

    /** Effort assessment (time vs output). */
    private String studentEfforts;

    /** Topics trending up. */
    private String topicsOfImprovement;

    /** Topics trending down / needing attention. */
    private String topicsOfDegradation;

    /** Concrete, prioritised action items (checklist). */
    private String remedialPoints;
}
