package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import java.util.Date;

public interface ManualAttemptResponseDto {
    String getAttemptId();
    String getUserId();
    String getEvaluationStatus();
    Date getSubmitTime();
    String getParticipantName();
}
