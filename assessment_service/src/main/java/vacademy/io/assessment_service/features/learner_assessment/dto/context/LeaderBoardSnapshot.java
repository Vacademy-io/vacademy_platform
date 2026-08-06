package vacademy.io.assessment_service.features.learner_assessment.dto.context;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;

/** Concrete mirror of {@link LeaderBoardDto}. See AssessmentOverviewSnapshot for why. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeaderBoardSnapshot implements LeaderBoardDto {
    private String attemptId;
    private String userId;
    private String studentName;
    private String batchId;
    private Long completionTimeInSeconds;
    private Double achievedMarks;
    private Integer rank;
    private Double percentile;

    public static LeaderBoardSnapshot from(LeaderBoardDto p) {
        if (p == null) return null;
        return LeaderBoardSnapshot.builder()
                .attemptId(p.getAttemptId())
                .userId(p.getUserId())
                .studentName(p.getStudentName())
                .batchId(p.getBatchId())
                .completionTimeInSeconds(p.getCompletionTimeInSeconds())
                .achievedMarks(p.getAchievedMarks())
                .rank(p.getRank())
                .percentile(p.getPercentile())
                .build();
    }
}
