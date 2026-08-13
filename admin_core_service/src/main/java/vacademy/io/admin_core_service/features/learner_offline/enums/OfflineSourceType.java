package vacademy.io.admin_core_service.features.learner_offline.enums;

/**
 * The node level an {@code offline_access_rule} row targets, forming the
 * ancestor chain the resolver walks: PACKAGE -> PACKAGE_SESSION -> SUBJECT ->
 * MODULE -> CHAPTER -> SLIDE. See OfflineAccessResolver for the resolution
 * algorithm over these levels.
 */
public enum OfflineSourceType {
    PACKAGE,
    PACKAGE_SESSION,
    SUBJECT,
    MODULE,
    CHAPTER,
    SLIDE
}
