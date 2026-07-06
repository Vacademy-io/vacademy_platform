package vacademy.io.admin_core_service.features.timeline.enums;

/**
 * Typed action-type constants for JOURNEY category timeline events.
 * Every automated system event on a lead must use one of these values
 * so the frontend can render a consistent, icon-mapped journey view.
 *
 * ACTIVITY category events (notes, calls) use their own free-form strings
 * and are kept separate via TimelineCategory.ACTIVITY.
 */
public enum LeadJourneyActionType {

    // ── Acquisition ──────────────────────────────────────────────────────────
    /** Lead form submitted / walk-in registered — first touch in the system. */
    LEAD_SUBMITTED,

    /** A duplicate submission was detected and merged into this lead. */
    DUPLICATE_MERGED,

    // ── Assignment ───────────────────────────────────────────────────────────
    /** A counselor was assigned (or reassigned) to this lead. */
    COUNSELOR_ASSIGNED,

    /** The assigned counselor was removed from this lead (back to unassigned pool). */
    COUNSELOR_UNASSIGNED,

    // ── Pipeline movement ────────────────────────────────────────────────────
    /** Lead moved from one pipeline status to another (metadata: from/to status). */
    STATUS_CHANGED,

    // ── Engagement signals ────────────────────────────────────────────────────
    /** A follow-up task was created or completed for this lead. */
    FOLLOWUP,

    /** An outreach attempt was made (email, WhatsApp, SMS) — logged by workflow or manually. */
    REACHOUT,

    // ── Scoring ──────────────────────────────────────────────────────────────
    /** Lead score was recalculated automatically (metadata: old_score, new_score, tier). */
    SCORE_UPDATED,

    /** An admin manually overrode the lead score (metadata: old_score, new_score, actor_name). */
    MANUAL_SCORE_UPDATE,

    // ── Terminal outcomes ────────────────────────────────────────────────────
    /** Lead was marked as Converted / enrolled. */
    LEAD_CONVERTED,

    /** Lead was marked as Lost / closed. */
    LEAD_LOST,

    // ── Post-conversion ──────────────────────────────────────────────────────
    /** Payment was received against this lead. */
    PAYMENT_RECEIVED,

    /** Enrollment into a course/session was completed. */
    ENROLLMENT_COMPLETED
}
