package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import java.util.Date;

/**
 * Native-query projection used by
 * {@code StudentAttemptRepository.findAssessmentHistorySummaryForUsersSince}.
 * One row per userId that has at least one ENDED attempt in the window.
 * Read-only; never mutated.
 */
public interface UserAssessmentHistorySummaryProjection {

    String getUserId();

    /** Count of ENDED attempts in the window. */
    Long getAttemptCount();

    /** Timestamp of the most recent attempt in the window. */
    Date getLastAttemptAt();

    /**
     * Average of per-attempt percentages (earned / achievable * 100) across attempts
     * with computable marks; null when no attempt allows a reliable computation.
     */
    Double getAvgPercentage();

    /** Assessment name of the most recent attempt in the window. */
    String getLastAssessmentName();
}
