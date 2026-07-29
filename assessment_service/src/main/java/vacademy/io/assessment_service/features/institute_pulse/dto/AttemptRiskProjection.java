package vacademy.io.assessment_service.features.institute_pulse.dto;

/**
 * One in-flight attempt that tripped at least one risk rule. The rules themselves are applied
 * in SQL (so the row cap is meaningful); the service only labels and orders them.
 */
public interface AttemptRiskProjection {

    String getAttemptId();

    String getAssessmentId();

    String getAssessmentName();

    String getUserId();

    String getParticipantName();

    /** Seconds since the server last heard from this client. NULL if it never synced. */
    Long getSecondsSinceSync();

    /** Seconds left before start_time + max_time. Negative once the attempt has overrun. */
    Long getSecondsRemaining();
}
