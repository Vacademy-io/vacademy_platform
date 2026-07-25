package vacademy.io.admin_core_service.features.course_pulse.dto;

/**
 * Raw row from the Roster native query (one per live learner). All time values are
 * computed server-side against now(), so they carry no client-clock skew.
 * The presentation {@code state} / {@code needsHelp} are derived from these in the service.
 */
public interface PulseRosterRowProjection {
    String getUserId();
    String getFullName();
    String getSlideId();
    String getSlideTitle();
    String getSlideType();
    String getChapterId();

    /** Seconds since the learner landed on this slide (now() - created_at). Drives "reading for N min". */
    Long getOnSlideSeconds();

    /** Seconds since the learner's most recent write (now() - last_seen_at). Drives presence state. */
    Long getLastSeenAgoSeconds();

    /** Wrong answers on the current slide (INCORRECT question + quiz attempts). Struggle signal. */
    Long getWrongCount();

    /** Failing code submissions on the current slide (not all tests passed). Struggle signal. */
    Long getFailedCodeCount();
}
