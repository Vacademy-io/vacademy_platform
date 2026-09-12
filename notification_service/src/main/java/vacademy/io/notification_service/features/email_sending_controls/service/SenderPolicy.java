package vacademy.io.notification_service.features.email_sending_controls.service;

import com.fasterxml.jackson.databind.JsonNode;
import vacademy.io.notification_service.constants.NotificationConstants;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;

/**
 * The sending rules an institute has put on one sender (EMAIL_SETTING.data.<type>).
 * Everything is optional; a node without these fields behaves exactly as before.
 *
 * @param maxPerDay      0 = unlimited
 * @param zone           day boundary for the cap (default UTC)
 * @param sendAfterHour  local hour the next day's window opens (default 0)
 * @param postalAddress  CAN-SPAM footer address (may be null)
 * @param listUnsubscribe add unsubscribe headers/footer even for non-promotional types
 */
public record SenderPolicy(int maxPerDay, ZoneId zone, int sendAfterHour, String postalAddress, boolean listUnsubscribe) {

    public static final SenderPolicy NONE = new SenderPolicy(0, ZoneId.of("UTC"), 0, null, false);

    public static SenderPolicy from(JsonNode node) {
        if (node == null || node.isMissingNode() || !node.isObject()) return NONE;
        int max = Math.max(0, node.path(NotificationConstants.MAX_PER_DAY).asInt(0));
        ZoneId zone = ZoneId.of("UTC");
        String tz = node.path(NotificationConstants.TIMEZONE).asText("");
        if (!tz.isBlank()) {
            try { zone = ZoneId.of(tz.trim()); } catch (Exception ignored) { /* keep UTC on a bad value */ }
        }
        int hour = node.path(NotificationConstants.SEND_AFTER_HOUR).asInt(0);
        if (hour < 0 || hour > 23) hour = 0;
        String addr = node.path(NotificationConstants.POSTAL_ADDRESS).asText("");
        boolean lu = node.path(NotificationConstants.LIST_UNSUBSCRIBE).asBoolean(false);
        return new SenderPolicy(max, zone, hour, addr.isBlank() ? null : addr.trim(), lu);
    }

    public boolean capped() { return maxPerDay > 0; }

    /** Calendar day the cap is counted against, right now, in the sender's zone. */
    public LocalDate today() { return LocalDate.now(zone); }

    /** When the next sending window opens: tomorrow at sendAfterHour in the sender's zone, as server-local time. */
    public LocalDateTime nextWindow() {
        ZonedDateTime next = LocalDate.now(zone).plusDays(1).atStartOfDay(zone).plusHours(sendAfterHour);
        return next.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    /** Whether unsubscribe headers + footer apply to a send of this type. */
    public boolean unsubscribeApplies(String emailType) {
        return listUnsubscribe
                || (emailType != null && NotificationConstants.PROMOTIONAL_EMAIL.equalsIgnoreCase(emailType.trim()));
    }

    /** Stable counter key for one sender identity. */
    public static String senderKey(String instituteId, String emailType, String fromEmail) {
        return ((instituteId == null ? "-" : instituteId) + "|" + (emailType == null ? "UTILITY_EMAIL" : emailType)
                + "|" + (fromEmail == null ? "-" : fromEmail)).toLowerCase(Locale.ROOT);
    }
}
