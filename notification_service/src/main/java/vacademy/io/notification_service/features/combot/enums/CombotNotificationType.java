package vacademy.io.notification_service.features.combot.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Enum for WhatsApp notification types used in notification_log table
 * Maps to notification_type column which has max length of 20 chars
 */
@Getter
@RequiredArgsConstructor
public enum CombotNotificationType {
    
    // Outgoing message types
    WHATSAPP_OUTGOING("WHATSAPP_MESSAGE_OUTGOING", "Message sent from system"),
    
    // Incoming message types  
    WHATSAPP_INCOMING("WHATSAPP_MESSAGE_INCOMING", "Message received from user"),
    
    // Status update types
    WHATSAPP_STATUS_SENT("WHATSAPP_MESSAGE_SENT", "Message sent to WhatsApp"),
    WHATSAPP_STATUS_DELIVERED("WHATSAPP_MESSAGE_DELIVERED", "Message delivered to user"),
    WHATSAPP_STATUS_READ("WHATSAPP_MESSAGE_READ", "Message read by user"),
    WHATSAPP_STATUS_FAILED("WHATSAPP_MESSAGE_FAILED", "Message delivery failed"),
    WHATSAPP_STATUS_UNKNOWN("WHATSAPP_MESSAGE_UNKNOWN", "Unknown status"),
    
    // Error types
    WHATSAPP_FAILED("WHATSAPP_MESSAGE_FAILED", "Message failed with error");

    private final String type;
    private final String description;

    /**
     * Map status string to notification type
     * @param status Status from webhook (sent, delivered, read, failed)
     * @return Corresponding notification type
     */
    public static CombotNotificationType fromStatus(String status) {
        if (status == null) {
            return WHATSAPP_STATUS_UNKNOWN;
        }
        
        return switch (status.toLowerCase()) {
            case "sent" -> WHATSAPP_STATUS_SENT;
            case "delivered" -> WHATSAPP_STATUS_DELIVERED;
            case "read" -> WHATSAPP_STATUS_READ;
            case "failed" -> WHATSAPP_STATUS_FAILED;
            default -> WHATSAPP_STATUS_UNKNOWN;
        };
    }
}
