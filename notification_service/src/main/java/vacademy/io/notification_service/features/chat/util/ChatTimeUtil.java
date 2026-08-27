package vacademy.io.notification_service.features.chat.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Chat rows store wall-clock {@link LocalDateTime} values in the server's zone (UTC in every
 * deployed environment). Serialising those straight to JSON emits no offset, so a browser parses
 * "2026-08-19T08:47:03" as its own local time and renders a 2:17 PM IST message as 8:47 AM.
 * Converting to {@link Instant} on the way out keeps an explicit offset on the wire.
 */
public final class ChatTimeUtil {

    private ChatTimeUtil() {
    }

    /** Reads a stored wall-clock value as an instant in the zone that wrote it. */
    public static Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.atZone(ZoneId.systemDefault()).toInstant();
    }
}
