package vacademy.io.community_service.feature.onboarding.enums;

/** Render type for a catalogue question, consumed by the public form FE. */
public enum QuestionType {
    TEXT,
    EMAIL,
    PHONE,
    TEXTAREA,
    URL,
    SELECT,
    MULTISELECT,
    BOOLEAN,
    COLOR,
    /** Icon cards the prospect expands to tick individual features. Answer is a flat list of codes. */
    FEATURE_GROUPS
}
