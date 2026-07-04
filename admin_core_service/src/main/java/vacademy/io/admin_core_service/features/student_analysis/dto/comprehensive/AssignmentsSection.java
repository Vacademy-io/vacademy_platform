package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssignmentsSection {

    private boolean available;

    /** Total assignments given. Null — assignment definitions not queryable without new query. */
    private Integer assigned;

    private Integer submitted;

    /** On-time submissions = submitted - late. */
    private Integer onTime;

    private Integer late;

    /** Pending = assigned - submitted. Null when assigned is null. */
    private Integer pending;

    /** Average score percentage across graded submissions. Null when no marks available. */
    private Double avgScorePercentage;

    /** Number of graded submissions (marks/feedback/checked-file present). */
    private Integer graded;

    /** Per-submission detail (used by the admin Assignments tab). */
    private List<AssignmentItem> items;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AssignmentItem {
        private String slideId;
        private String title;
        private Double marks;
        /** Score as a percentage of the assignment's total marks; null when ungraded / total unknown. */
        private Double scorePercentage;
        private Boolean late;
        private String feedback;
        private String reviewStatus;
    }
}
