package vacademy.io.admin_core_service.features.institute.dto.settings.doubt_management;

public enum DoubtDefaultAssigneeSourceEnum {
    SUBJECT_TEACHER,
    BATCH_TEACHER,
    BOTH,
    /** Route to all users holding a given role in the institute (per-type routing, e.g. PAYMENT → ADMIN). */
    ROLE,
    /** Route to an explicit list of handler user ids (per-type routing, e.g. TECHNICAL → support staff). */
    SPECIFIC_USERS,
    NONE
}
