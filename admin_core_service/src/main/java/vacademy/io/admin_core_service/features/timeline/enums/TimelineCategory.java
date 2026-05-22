package vacademy.io.admin_core_service.features.timeline.enums;

/**
 * Separates system-logged lead-lifecycle events (JOURNEY) from
 * manual admin interactions like notes and call logs (ACTIVITY).
 *
 * Stored as a VARCHAR(20) column on timeline_event so existing rows
 * default to ACTIVITY and both use cases share the same table.
 */
public enum TimelineCategory {
    /** Automated or system-recorded lifecycle events: submission, status changes, score updates, etc. */
    JOURNEY,
    /** Manual admin interactions: notes, call logs, follow-ups, meetings. */
    ACTIVITY
}
