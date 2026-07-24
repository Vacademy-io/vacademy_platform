package vacademy.io.community_service.feature.support.enums;

/**
 * Where a support ticket originated.
 * PORTAL = raised by the institute from their admin dashboard.
 * The rest are channels the support team logs a ticket on the client's behalf from.
 */
public enum TicketSource {
    PORTAL,
    EMAIL,
    WHATSAPP,
    PHONE,
    MANUAL,
    OTHER;

    public static TicketSource fromName(String value, TicketSource fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return TicketSource.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
