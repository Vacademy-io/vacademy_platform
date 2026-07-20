package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

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
}
