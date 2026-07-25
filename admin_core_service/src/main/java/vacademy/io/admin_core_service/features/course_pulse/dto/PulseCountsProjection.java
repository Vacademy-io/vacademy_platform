package vacademy.io.admin_core_service.features.course_pulse.dto;

/**
 * Aggregate presence counts over the latest-per-learner set for a batch.
 * Computed in one pass so the KPI strip is always exact, independent of the
 * (capped) roster list.
 */
public interface PulseCountsProjection {
    /** last_seen within the active window. */
    Long getActiveCount();

    /** last_seen between the active and offline windows. */
    Long getIdleCount();

    /** active AND on one slide past the stuck threshold (v1 presence-only proxy for "needs help"). */
    Long getNeedHelpCount();
}
