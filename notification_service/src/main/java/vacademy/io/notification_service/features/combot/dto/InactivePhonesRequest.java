package vacademy.io.notification_service.features.combot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request to find phone numbers that received outgoing WhatsApp on a channel but
 * sent no inbound reply within the lookback window. Phone-based (channel_id) — unlike
 * {@link InactiveUsersRequest} it does NOT depend on the outgoing row carrying a
 * user_id, so it works on channels where outgoing user_id logging is absent.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InactivePhonesRequest {
    private String senderBusinessChannelId;  // e.g., "919579465864"
    private Integer days;                     // lookback window, e.g., 3
}
