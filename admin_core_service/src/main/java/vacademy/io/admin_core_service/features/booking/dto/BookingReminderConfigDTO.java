package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Serialized into {@code booking_page.reminder_config_json}.
 * Channels: EMAIL, WHATSAPP (WhatsApp requires an approved Meta template;
 * the dispatcher silently skips channels the institute can't send on).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingReminderConfigDTO {

    /** Send a confirmation to the invitee (and notify the host) on booking. */
    private Boolean onBookingConfirmation;

    /** Channels for the confirmation + reminders: EMAIL | WHATSAPP. */
    private List<String> channels;

    /** Minutes before the meeting to send reminders, e.g. [1440, 60]. */
    private List<Integer> beforeMeetingOffsetsMinutes;

    // ── WhatsApp confirmation (used when channels contains WHATSAPP) ──
    /** Approved Meta/WhatsApp template name to send on booking. */
    private String whatsappTemplateName;
    /** Template language code (e.g. "en"); defaults to "en" if blank. */
    private String whatsappLanguageCode;
    /** Map of template variable name -> source: a booking field key
     *  ("invitee_name","meeting_datetime","meeting_date","meeting_time",
     *  "meet_link","host_name","meeting_title","duration_minutes") or "static:<literal>". */
    private Map<String, String> whatsappVariableMapping;
}
