package vacademy.io.admin_core_service.features.institute.enums;

public enum SettingKeyEnums {
    NAMING_SETTING,
    COURSE_SETTING,
    CERTIFICATE_SETTING,
    CUSTOM_FIELD_SETTING,
    LMS_SETTING,
    ROLE_DISPLAY_SETTING,
    LEAD_SETTING,
    DOUBT_MANAGEMENT_SETTING,
    LIVE_SESSION_SETTING,
    AUDIENCE_ROLE_ACCESS,
    SLIDE_DOWNLOAD_PERMISSION_SETTING,
    SLIDE_CONTENT_PROTECTION_SETTING,
    AI_CALLING_SETTING,
    CRM_INTELLIGENCE_SETTING,
    VOICE_CALLING_SETTING,
    PARENT_SETTING,
    // Role-based institute color theme (brand/accent/nav) — see
    // GenericSettingStrategy for read/write; institute_theme_code on the
    // Institute entity remains the legacy single-hue fallback.
    THEME_SETTING
}
