package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import java.util.Date;

/**
 * Native-query projection used by
 * {@code StudentAttemptRepository.findAssessmentHistoryForUserInDateRange}.
 * Read-only; never mutated.
 */
public interface StudentAttemptHistoryProjection {

    String getAssessmentId();

    String getAssessmentName();

    String getAttemptId();

    Date getAttemptDate();

    /** Student's earned marks for the attempt. */
    Double getTotalMarks();

    Long getDurationInSeconds();

    /** PASS / FAIL / COMPLETED / null — populated when report is released. */
    String getResultStatus();
}
