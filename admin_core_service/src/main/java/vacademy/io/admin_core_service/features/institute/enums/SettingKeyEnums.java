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
    THEME_SETTING,
    ONBOARDING_SETTING,
    // Institute-level language/i18n preferences (default locale, enabled
    // locales) — tags must come from vacademy.io.common.core.i18n.LocaleRegistry.
    // Read/write handled by GenericSettingStrategy like any other key.
    LANGUAGE_SETTING,
    // Institute-level payment behaviour. Currently carries
    // packageSessionRenewalSchedulerEnabled (default false): opts the institute
    // into the daily enrolment-policy expiry/renewal scan
    // (PackageSessionScheduler.processPackageSessionRenewals). Read/write via
    // GenericSettingStrategy; absence of the key means everything stays off.
    PAYMENT_SETTING,
    // Institute-wide offline content download master switch + defaults
    // ({"enabled": false, "revalidationDays": 7, "maxDevices": 2}). enabled=false
    // zeroes out every per-node offline permission regardless of course/rule
    // settings (OfflineAccessResolver). Read/write via OfflineSettingService,
    // which layers on GenericSettingStrategy like any other key.
    OFFLINE_ACCESS_SETTING,
    // Whether STAFF see the LLM-analytics insight reports (activity_log.processed_json)
    // that the pipeline already produces per attempt ({"adminActivityInsightsEnabled":
    // false}). Read/write via GenericSettingStrategy like any other key; absence of the
    // key means off. Deliberately opt-in: an institute should choose to expose AI-written
    // commentary about a learner rather than find it already exposed.
    // NOTE: learner-side visibility is NOT here. It rides on the existing
    // canViewReports permission in STUDENT_DISPLAY_SETTING, which already gates the
    // My Reports section the insights tab lives inside.
    AI_INSIGHTS_SETTING
}
