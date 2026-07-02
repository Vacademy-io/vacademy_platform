package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Doubts and engagement section for the v2 report.
 * Serialized as {@code doubts_and_engagement} at the top level.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DoubtsAndEngagementSection {

    private boolean available;

    /** Total doubts raised (renamed from "raised"). */
    private Integer questionsAsked;

    private Integer resolved;

    /** Average resolution time in hours. */
    private Double avgResolutionHours;

    /** LLM-generated engagement note. Null until narration or left null when no doubts. */
    private String note;
}
