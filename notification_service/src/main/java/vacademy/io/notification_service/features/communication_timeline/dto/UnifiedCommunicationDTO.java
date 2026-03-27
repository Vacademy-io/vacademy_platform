package vacademy.io.notification_service.features.communication_timeline.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedCommunicationDTO {

    private String id;

    /**
     * Channel type: EMAIL, WHATSAPP, PUSH, SMS
     */
    private String channel;

    /**
     * Direction: OUTBOUND or INBOUND
     */
    private String direction;

    /**
     * Email subject, WA template name, or push notification title
     */
    private String title;

    /**
     * Truncated preview of message body (first 150 chars)
     */
    private String bodyPreview;

    /**
     * Full message body (for expanded view)
     */
    private String fullBody;

    /**
     * WhatsApp template name if applicable
     */
    private String templateName;

    /**
     * Current status: PENDING, SENT, DELIVERED, READ, FAILED, BOUNCED
     */
    private String status;

    /**
     * Chronological list of status changes
     */
    private List<StatusEvent> statusTimeline;

    /**
     * Sender info (email address, phone number, or system name)
     */
    private String senderInfo;

    /**
     * Recipient info (email address, phone number)
     */
    private String recipientInfo;

    /**
     * When the message was sent or received
     */
    private LocalDateTime timestamp;

    /**
     * Source system (e.g., announcement-service, chatbot-flow, otp, email-service)
     */
    private String source;

    /**
     * Source entity ID (e.g., announcement ID)
     */
    private String sourceId;

    /**
     * Channel-specific metadata (parsed from messagePayload)
     */
    private Map<String, Object> metadata;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusEvent {
        private String status;
        private LocalDateTime timestamp;
        private String details;
    }
}
