package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import java.util.Date;

public interface ParticipantsQuestionOverallDetailDto {
    String getAttemptId();
    String getUserId();
    Long getCompletionTimeInSeconds();
    Double getAchievedMarks();
    Date getStartTime();
    String getSubjectId();
    Double getPercentile();
    Integer getCorrectAttempt();
    Integer getWrongAttempt();
    Integer getPartialCorrectAttempt();
    Integer getSkippedCount();
}
