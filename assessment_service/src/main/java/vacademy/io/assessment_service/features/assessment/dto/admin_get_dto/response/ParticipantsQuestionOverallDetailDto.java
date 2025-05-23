package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import java.util.Date;

public interface ParticipantsQuestionOverallDetailDto {
    String getAttemptId();

    String getUserId();

    Long getCompletionTimeInSeconds();

    Double getAchievedMarks();

    Date getStartTime();

    Date getSubmitTime();

    String getSubjectId();

    Double getPercentile();

    Integer getCorrectAttempt();

    Integer getWrongAttempt();

    Integer getPartialCorrectAttempt();

    Integer getSkippedCount();

    Double getTotalCorrectMarks();

    Double getTotalIncorrectMarks();

    Double getTotalPartialMarks();

    Integer getRank();
}
