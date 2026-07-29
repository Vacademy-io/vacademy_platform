package vacademy.io.admin_core_service.features.mentorship.enums;

/**
 * How a {@code mentor_student_assignment} row was created.
 * MANUAL      = admin searched and selected specific students for a mentor.
 * ROUND_ROBIN = bulk equal distribution of students across a chosen mentor group.
 * BULK        = reserved for future bulk imports that aren't round-robin.
 */
public enum AssignmentMethod {
    MANUAL,
    ROUND_ROBIN,
    BULK
}
