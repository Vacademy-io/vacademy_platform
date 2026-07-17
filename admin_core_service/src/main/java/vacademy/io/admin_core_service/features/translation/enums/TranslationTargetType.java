package vacademy.io.admin_core_service.features.translation.enums;

/** Which sidecar table a batch-upsert item / state change targets. */
public enum TranslationTargetType {
    RICH_TEXT,
    ENTITY_FIELD,
    MEDIA;

    public static TranslationTargetType fromString(String value) {
        try {
            return TranslationTargetType.valueOf(value.trim().toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }
}
