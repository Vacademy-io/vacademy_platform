package vacademy.io.admin_core_service.features.institute_pulse.dto;

/**
 * Institute-wide live-class totals, independent of which page of cards is shown.
 *
 * <p>Split out for the same reason as the assessment totals: the KPI strip needs figures across
 * every on-air class, so summing the loaded page would silently mean "page 1 only". These are
 * aggregates over the on-air set with no per-session card payload attached.
 */
public interface LiveClassTotalsProjection {

    Long getOnAirCount();

    Long getUpcomingCount();

    /** Expanded invited head count across all on-air classes. */
    Long getInvitedNow();

    /** Distinct learners who have joined any on-air class. "Ever joined", not occupancy. */
    Long getJoinedNow();
}
