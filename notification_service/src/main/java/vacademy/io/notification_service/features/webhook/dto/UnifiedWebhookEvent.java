package vacademy.io.notification_service.features.webhook.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Unified webhook event model that normalizes payloads from different vendors
 * (WATI, Meta, Twilio, etc.) into a common format for processing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedWebhookEvent {

    /**
     * Vendor identifier (WATI, META, TWILIO, etc.)
     */
    private String vendor;

    /**
     * Communication channel (WHATSAPP, SMS, EMAIL)
     */
    private String channel;

    /**
     * Normalized event type
     */
    private EventType eventType;

    /**
     * External message ID from the vendor
     */
    private String externalMessageId;

    /**
     * Phone number in normalized format (without + or country code prefix
     * variations)
     */
    private String phoneNumber;

    /**
     * Message text for REPLY events
     */
    private String messageText;

    /**
     * Event timestamp
     */
    private Instant timestamp;

    /**
     * Error code for FAILED events
     */
    private String errorCode;

    /**
     * Error message for FAILED events
     */
    private String errorMessage;

    /**
     * Institute ID for multi-tenancy (if extractable from payload)
     */
    private String instituteId;

    /**
     * Original raw payload for debugging/auditing
     */
    private Map<String, Object> rawPayload;

    /**
     * Sender name (for incoming messages)
     */
    private String senderName;

    /**
     * Business channel ID - identifies which business account this webhook is for.
     * For WATI: Comes from URL path parameter (since payload doesn't include it)
     * For Meta: Extracted from payload.metadata.phone_number_id
     * For others: Vendor-specific extraction
     */
    private String businessChannelId;

    /**
     * Unified event types across all vendors
     */
    public enum EventType {
        SENT,
        DELIVERED,
        READ,
        FAILED,
        REPLY,
        VERIFICATION_RESPONSE,
        UNKNOWN
    }

    /**
     * Known vendor identifiers
     */
    public static class Vendors {
        public static final String WATI = "WATI";
        public static final String META = "META";
        public static final String TWILIO = "TWILIO";
    }

    /**
     * Communication channels
     */
    public static class Channels {
        public static final String WHATSAPP = "WHATSAPP";
        public static final String SMS = "SMS";
        public static final String EMAIL = "EMAIL";
    }
}
