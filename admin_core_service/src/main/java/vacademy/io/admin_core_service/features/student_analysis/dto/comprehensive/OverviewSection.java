package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Deterministic overview section computed from the assembled collector sections.
 * {@code one_line} is LLM-generated (set after narration).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OverviewSection {

    /** "On Track" | "Needs Attention" | "At Risk" */
    private String overallStatus;

    /** Letter grade derived from average score: A+/A/B+/B/C/D */
    private String overallGrade;

    /** LLM-generated one-liner. Null until narration completes. */
    private String oneLine;

    private List<HeadlineMetric> headlineMetrics;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HeadlineMetric {
        private String key;
        private String label;
        /** Number or formatted string (e.g. "7 / 42"). */
        private Object value;
        /** "%" or "hrs" or null for dimensionless. */
        private String unit;
        /** "up" | "down" | "steady" | null if prior report unavailable. */
        private String trend;
        /** e.g. "+4% vs May" — null if no prior report. */
        private String change;
        /** "good" | "neutral" | "attention" */
        private String sentiment;
    }
}
