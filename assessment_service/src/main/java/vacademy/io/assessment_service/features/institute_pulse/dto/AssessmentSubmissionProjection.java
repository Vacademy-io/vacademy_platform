package vacademy.io.assessment_service.features.institute_pulse.dto;

/** One just-submitted attempt, for the institute-wide live feed. */
public interface AssessmentSubmissionProjection {

    String getAttemptId();

    String getAssessmentId();

    String getAssessmentName();

    String getUserId();

    String getParticipantName();

    Long getSubmittedAtEpoch();
}
