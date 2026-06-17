package vacademy.io.community_service.feature.support.enums;

public enum TicketCategory {
    BUG,
    QUESTION,
    BILLING,
    FEATURE_REQUEST,
    OTHER;

    public static TicketCategory fromName(String value, TicketCategory fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return TicketCategory.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
