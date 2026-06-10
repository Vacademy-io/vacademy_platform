package vacademy.io.admin_core_service.features.doubts.enums;

public enum DoubtsSourceEnum {
    /** Doubt anchored to a slide (academic, has source_id + optional content_position). */
    SLIDE,
    /**
     * General query/issue not tied to any content (e.g. Technical Issue, Payment Issue raised from
     * the learner top-bar "?" icon or dashboard card). source_id / content_position are absent;
     * routing is driven by the doubt's {@code type} via DOUBT_MANAGEMENT_SETTING.queryTypes.
     */
    GENERAL
}
