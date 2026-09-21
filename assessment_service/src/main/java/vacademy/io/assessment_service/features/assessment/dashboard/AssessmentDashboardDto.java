package vacademy.io.assessment_service.features.assessment.dashboard;

import java.util.Date;
import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Everything the Assessments Overview tab shows, in one response. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentDashboardDto {

    private Counts counts;
    private Participation participation;
    private Pending pending;
    private List<BatchPerformance> batches;
    private List<AssessmentPerformance> assessments;
    private Date generatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Counts {
        private long live;
        private long upcoming;
        private long previous;
        private long draft;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Participation {
        private long registeredLearners;
        private long attemptedLearners;
        private long attemptsTotal;
        private long attemptsLast7Days;
        private long liveAttempts;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Pending {
        private long manualEvaluationPending;
        private long aiChecksRunning;
        private long aiChecksFailed;
        private long resultsToRelease;
        private long reattemptRequestsPending;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class BatchPerformance {
        private String batchId;
        private long assessments;
        private long learners;
        private long attempts;
        private Double avgPercent;
        private Double bestPercent;
        private Double lowestPercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AssessmentPerformance {
        private String assessmentId;
        private String name;
        private String playMode;
        private String visibility;
        private String evaluationType;
        private Date startTime;
        private Date endTime;
        private long participants;
        private long attempted;
        private Double avgPercent;
        private long pendingEvaluation;
        private long toRelease;
    }
}
