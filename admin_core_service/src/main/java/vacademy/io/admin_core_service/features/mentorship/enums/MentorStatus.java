package vacademy.io.admin_core_service.features.mentorship.enums;

/**
 * Lifecycle of a {@code mentor} / {@code mentor_student_assignment} row.
 * Stored as the string name in the {@code status} column; soft-delete is
 * {@code DELETED} (partial unique indexes exclude it).
 */
public enum MentorStatus {
    ACTIVE,
    INACTIVE,
    DELETED
}
