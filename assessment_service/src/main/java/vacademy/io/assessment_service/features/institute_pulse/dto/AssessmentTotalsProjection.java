package vacademy.io.assessment_service.features.institute_pulse.dto;

/**
 * Institute-wide totals for the assessment rail, independent of which page of assessments is
 * being shown.
 *
 * <p><b>Deliberately only two numbers.</b> Enrolled / not-started / submitted totals would each
 * require aggregating every registration across every live assessment — exactly the work
 * pagination exists to avoid — and summing them across the loaded pages would silently mean
 * "page 1 only". Both fields here are cheap scalars: the assessment count touches only
 * {@code assessment}, and the in-progress count drives from {@code idx_sa_status_start}, where
 * the LIVE set is small by definition.
 */
public interface AssessmentTotalsProjection {

    Long getLiveAssessments();

    Long getInProgress();
}
