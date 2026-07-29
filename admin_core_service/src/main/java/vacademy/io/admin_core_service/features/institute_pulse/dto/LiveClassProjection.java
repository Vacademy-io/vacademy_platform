package vacademy.io.admin_core_service.features.institute_pulse.dto;

/** One live-class card: an on-air or upcoming schedule with its invited/joined counts. */
public interface LiveClassProjection {

    String getSessionId();

    String getScheduleId();

    String getTitle();

    String getSubject();

    Long getStartEpoch();

    Long getEndEpoch();

    /** BBB / ZOOM / GOOGLE / null — drives the attendance-freshness treatment in the UI. */
    String getProvider();

    /** Last provider attendance sync. NULL for live-at-join providers. */
    Long getLastSyncEpoch();

    /** Expanded head count of everyone invited (BATCH participants expanded to learners). */
    Long getInvitedCount();

    /**
     * Distinct learners with an ATTENDANCE_RECORDED / PRESENT row. This is "ever joined",
     * NOT "in the room now" — we discard provider leave events.
     */
    Long getJoinedCount();

    /** Whether any attendance row exists yet, i.e. has anyone actually turned up. */
    Boolean getStarted();

    /** Past its last-entry cutoff but still inside the overrun grace window. */
    Boolean getRunningOver();
}
