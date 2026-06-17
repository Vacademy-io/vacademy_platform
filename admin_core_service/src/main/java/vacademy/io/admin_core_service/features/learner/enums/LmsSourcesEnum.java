package vacademy.io.admin_core_service.features.learner.enums;

public enum LmsSourcesEnum {
    // Selectable institute "active LMS" options. Moodle is intentionally NOT a
    // selectable active LMS — Moodle integration is configured per-course via the
    // MOODLE_SETTING key (read by the Moodle enrollment workflow), not here.
    LEARNDASH,
    VACADEMY,
}
