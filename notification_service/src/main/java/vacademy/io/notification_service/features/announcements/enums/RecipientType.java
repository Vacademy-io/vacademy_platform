package vacademy.io.notification_service.features.announcements.enums;

public enum RecipientType {
    ROLE,
    USER,
    PACKAGE_SESSION,
    PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES,
    TAG,
    CUSTOM_FIELD_FILTER,
    AUDIENCE  // Campaign-based recipient (leads converted to users)
}