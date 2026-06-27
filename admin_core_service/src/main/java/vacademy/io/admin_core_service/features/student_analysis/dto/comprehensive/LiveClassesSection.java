package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LiveClassesSection {

    private boolean available;
    private Integer attended;
    private Integer missed;

    /** Total sessions = attended + missed + unmarked. */
    private Integer total;

    /** Attendance percentage = attended / total * 100. */
    private Double attendancePercentage;

    /**
     * Typed participation detail.
     * Null — engagement data (questions asked / polls answered) is not
     * available from ScheduleAttendanceProjection.
     */
    private ParticipationDetail participation;

    // Internal count — not serialized
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Integer unmarked;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ParticipationDetail {
        private Integer questionsAsked;
        private Integer pollsAnswered;
        /** "Active" | "Moderate" | "Low" */
        private String avgEngagement;
    }
}
