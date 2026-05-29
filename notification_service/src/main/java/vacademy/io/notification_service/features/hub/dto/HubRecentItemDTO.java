package vacademy.io.notification_service.features.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HubRecentItemDTO {

    private String id;
    /** WHATSAPP | EMAIL */
    private String channel;
    /** Counterparty identifier — phone for WhatsApp, email for inbound email. */
    private String from;
    /** Display name resolved from sender_name (WhatsApp) or null. */
    private String fromName;
    /** Linked user_id if the system was able to resolve the contact. */
    private String userId;
    /** Subject (email) or message preview (WhatsApp), truncated to ~120 chars. */
    private String preview;
    private Instant timestamp;
}
