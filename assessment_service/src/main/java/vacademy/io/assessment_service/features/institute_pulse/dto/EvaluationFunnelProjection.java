package vacademy.io.assessment_service.features.institute_pulse.dto;

/**
 * Post-submission state for one recently-ended assessment: where its submitted attempts are in
 * the evaluation → release pipeline.
 *
 * <p>Counts cover SUBMITTED attempts only ({@code student_attempt.status = 'ENDED'}) — an
 * unstarted or abandoned attempt has nothing to evaluate, so including it would make the
 * denominator meaningless.
 */
public interface EvaluationFunnelProjection {

    String getAssessmentId();

    String getAssessmentName();

    Long getEndedAtEpoch();

    /** Submitted attempts. awaiting + evaluating + evaluated + failed sums to this. */
    Long getSubmitted();

    /** result_status PENDING — nothing has picked it up yet. */
    Long getAwaiting();

    /** result_status EVALUATING or AI_EVALUATION_IN_PROGRESS. */
    Long getEvaluating();

    /** result_status COMPLETED or AI_EVALUATION_COMPLETED. */
    Long getEvaluated();

    /** result_status AI_EVALUATION_FAILED — needs a human, and nothing else will move it. */
    Long getFailed();

    /** report_release_status RELEASED. A subset of evaluated, NOT a further disjoint stage. */
    Long getReleased();
}
