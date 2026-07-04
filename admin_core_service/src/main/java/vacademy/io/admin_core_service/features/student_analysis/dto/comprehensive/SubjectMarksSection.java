package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * v2 comprehensive report ADDITIVE section: "Marks by Subject".
 *
 * <p>Aggregates every mark-bearing item a learner did in the report window
 * (assessments, assignments, quiz slides, question slides) into per-subject
 * totals. Populated by {@code SubjectMarksCollector}, folded under the
 * {@code ACADEMICS} module (no new {@code ReportModule} key). Subject
 * clustering is attempted via {@code ComprehensiveReportLLMService} and falls
 * back deterministically (group by the DB subject hint) on any LLM failure —
 * see {@code SubjectMarksCollector#deterministicGroup}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubjectMarksSection {

    private boolean available;

    /** Per-subject aggregated marks (LLM-clustered, or deterministic fallback). */
    private List<SubjectMarks> subjects;

    /** Raw graded items collected across all 4 sources — kept for transparency / LLM input. */
    private List<GradedItem> items;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SubjectMarks {
        private String subject;
        private Double marksObtained;
        private Double totalMarks;
        /** Recomputed in Java from marksObtained/totalMarks — never trust LLM math. */
        private Double percentage;
        private Integer itemCount;
        /** Titles of the graded items clustered into this subject (LLM-provided; empty in fallback). */
        private List<String> topics;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class GradedItem {
        /** ASSESSMENT | ASSIGNMENT | QUIZ | QUESTION */
        private String type;
        private String title;
        /** DB-derived subject hint; null when unresolvable (e.g. orphaned slide). */
        private String subject;
        private Double marksObtained;
        private Double totalMarks;
    }
}
