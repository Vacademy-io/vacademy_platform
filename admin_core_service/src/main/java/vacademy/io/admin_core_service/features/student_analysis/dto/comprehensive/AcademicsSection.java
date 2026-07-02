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
public class AcademicsSection {

    private boolean available;

    /** Average percentage across all assessments in the window. */
    private Double averagePercentage;

    /** Class average percentage across all assessments (if available). */
    private Double classAveragePercentage;

    /** Subject with the highest average score. */
    private String bestSubject;

    /** Subject with the lowest average score. */
    private String weakestSubject;

    private List<AssessmentItem> assessments;

    /** Per-subject performance rollup computed from assessments. */
    private List<SubjectPerformance> subjectPerformance;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AssessmentItem {
        private String assessmentId;

        /** Assessment name — key: "name" */
        private String name;

        /** Attempt date ISO string — key: "date" */
        private String date;

        /** Subject label (e.g. "Physics"). */
        private String subject;

        private Double marks;
        private Double totalMarks;
        private Double percentage;

        /** Letter grade: A+/A/B+/B/C/D */
        private String grade;

        private Integer rank;
        private Double percentile;

        /** Class average marks for this assessment. */
        private Double classAverage;

        /** "PASS" | "NEEDS_WORK" | "FAIL" */
        private String status;

        // Legacy fields kept for internal parsing from AssessmentServiceClient;
        // they are serialized but not used by the frontend v2 display.
        private String assessmentId2;  // unused — was assessmentId (same field)
        private String attemptId;
        private Double accuracy;
        private Double classAccuracy;
        private Long durationSeconds;
        private List<SectionItem> sections;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SectionItem {
        private String sectionId;
        private String sectionName;
        private Double studentMarks;
        private Double sectionTotalMarks;
        private Double sectionAverageMarks;
        private Double studentAccuracy;
        private Double classAccuracy;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SubjectPerformance {
        private String subject;
        private Double scorePercentage;
        private Double classAverage;
        /** "up" | "down" | "steady" | null when insufficient data. */
        private String trend;
        /** "good" | "neutral" | "attention" */
        private String sentiment;
    }
}
