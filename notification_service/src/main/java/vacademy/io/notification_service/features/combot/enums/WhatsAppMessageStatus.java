package vacademy.io.notification_service.features.combot.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Enum for WhatsApp message statuses as received from webhooks
 */
@Getter
@RequiredArgsConstructor
public enum WhatsAppMessageStatus {
    
    SENT("sent", "Message sent to WhatsApp server"),
    DELIVERED("delivered", "Message delivered to user device"),
    READ("read", "Message read by user"),
    FAILED("failed", "Message delivery failed"),
    UNKNOWN("unknown", "Unknown status");

    private final String status;
    private final String description;

    /**
     * Get enum from status string
     */
    public static WhatsAppMessageStatus fromString(String status) {
        if (status == null) {
            return UNKNOWN;
        }
        
        for (WhatsAppMessageStatus messageStatus : values()) {
            if (messageStatus.status.equalsIgnoreCase(status)) {
                return messageStatus;
            }
        }
        
        return UNKNOWN;
    }
}
