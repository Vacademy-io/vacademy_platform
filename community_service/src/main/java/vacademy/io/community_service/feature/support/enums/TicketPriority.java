package vacademy.io.community_service.feature.support.enums;

public enum TicketPriority {
    MAJOR,
    MINOR;

    public static TicketPriority fromName(String value, TicketPriority fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return TicketPriority.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
