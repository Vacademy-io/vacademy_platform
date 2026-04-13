package vacademy.io.admin_core_service.features.common.enums;

public enum CustomFieldTypeEnum {
    /** Institute-wide default field, managed in Settings → Custom Fields. */
    DEFAULT_CUSTOM_FIELD,

    /** Per enroll invite mapping, scoped by type_id = enroll_invite.id */
    ENROLL_INVITE,

    /** Per audience campaign mapping, scoped by type_id = audience.id */
    AUDIENCE_FORM,

    /** Per live class / live session schedule mapping, scoped by type_id = live_session.id */
    SESSION,

    /** Per assessment mapping, scoped by type_id = assessment.id */
    ASSESSMENT
}
