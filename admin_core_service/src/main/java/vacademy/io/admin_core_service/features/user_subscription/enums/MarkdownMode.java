package vacademy.io.admin_core_service.features.user_subscription.enums;

public enum MarkdownMode {
    PERCENT,
    ABSOLUTE;

    public static MarkdownMode fromString(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("MarkdownMode cannot be null or blank.");
        }
        try {
            return MarkdownMode.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid MarkdownMode: " + value, e);
        }
    }
}
