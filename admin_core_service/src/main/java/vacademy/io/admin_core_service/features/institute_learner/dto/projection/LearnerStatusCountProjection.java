package vacademy.io.admin_core_service.features.institute_learner.dto.projection;

/**
 * Dashboard learner-status breakdown. Each count is DISTINCT learners, so a
 * learner enrolled in several batches is counted once per status — which also
 * means the three need not sum to a distinct headcount: someone ACTIVE in one
 * batch and TERMINATED in another lands in both buckets.
 */
public interface LearnerStatusCountProjection {
    /** Every learner mapped to the institute, any status. */
    Long getTotalCount();

    Long getActiveCount();

    Long getInactiveCount();

    Long getTerminatedCount();
}
