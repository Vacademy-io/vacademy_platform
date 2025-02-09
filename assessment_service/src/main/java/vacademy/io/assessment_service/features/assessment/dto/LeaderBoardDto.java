package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface LeaderBoardDto {
    String getAttemptId();
    String getUserId();
    String getStudentName();
    String getBatchId();
    Long getCompletionTimeInSeconds();
    Double getAchievedMarks();
    Integer getRank();
}
