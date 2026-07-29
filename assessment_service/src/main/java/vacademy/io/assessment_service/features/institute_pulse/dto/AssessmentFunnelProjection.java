package vacademy.io.assessment_service.features.institute_pulse.dto;

/**
 * One row per assessment that is live right now for the institute, with its registrations
 * bucketed by effective attempt state.
 *
 * <p>Unquoted camelCase aliases in the native query are lower-cased by Postgres and matched
 * case-insensitively to these getters — same convention as {@code PulseRepository} in
 * admin_core_service.
 */
public interface AssessmentFunnelProjection {

    String getAssessmentId();

    String getAssessmentName();

    Long getStartEpoch();

    Long getEndEpoch();

    /** Registrations for this assessment in this institute. The funnel buckets sum to this. */
    Long getEnrolled();

    Long getNotStarted();

    Long getInPreview();

    Long getInProgress();

    Long getSubmitted();
}
