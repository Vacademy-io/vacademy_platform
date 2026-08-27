package vacademy.io.admin_core_service.features.mentorship.enums;

/**
 * Lifecycle of a learner's {@code mentor_request}.
 * PENDING   = waiting on an admin decision (at most one live per student+mentor).
 * APPROVED  = admin accepted; a mentor_student_assignment row was created.
 * DECLINED  = admin rejected, optionally with a note shown to the learner.
 * CANCELLED = the learner withdrew it before a decision.
 */
public enum MentorRequestStatus {
    PENDING,
    APPROVED,
    DECLINED,
    CANCELLED
}
