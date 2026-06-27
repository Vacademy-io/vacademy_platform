package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Course progress section. Serialized as {@code course_progress} at the top level.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProgressSection {

    private boolean available;

    /** Overall course completion percentage across all subjects. */
    private Double overallCompletionPercentage;

    private List<SubjectProgress> subjects;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SubjectProgress {
        /** Internal subject ID — not in sample output. */
        @JsonIgnore
        private String subjectId;

        /** Subject display name — serialized as "subject". */
        private String subject;

        /** Completion percentage for this subject. */
        private Double completionPercentage;

        /** Total study time in hours (rounded to 1 decimal). */
        private Double timeHours;
    }
}
