package vacademy.io.notification_service.features.combot.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Enum for WhatsApp message types as received in webhooks
 */
@Getter
@RequiredArgsConstructor
public enum WhatsAppMessageType {
    
    TEXT("text", "Plain text message"),
    BUTTON("button", "Button reply message"),
    INTERACTIVE("interactive", "Interactive message (list/button)"),
    IMAGE("image", "Image message"),
    VIDEO("video", "Video message"),
    DOCUMENT("document", "Document message"),
    AUDIO("audio", "Audio message"),
    LOCATION("location", "Location message"),
    CONTACTS("contacts", "Contacts message"),
    UNKNOWN("unknown", "Unknown message type");

    private final String type;
    private final String description;

    /**
     * Get enum from type string
     */
    public static WhatsAppMessageType fromString(String type) {
        if (type == null) {
            return UNKNOWN;
        }
        
        for (WhatsAppMessageType messageType : values()) {
            if (messageType.type.equalsIgnoreCase(type)) {
                return messageType;
            }
        }
        
        return UNKNOWN;
    }
}
