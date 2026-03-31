package vacademy.io.notification_service.features.send.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedSendRequest {

    private String instituteId;

    /**
     * Channel: WHATSAPP, EMAIL, PUSH, SYSTEM_ALERT
     */
    private String channel;

    /**
     * For WhatsApp template messages or email template IDs
     */
    private String templateName;

    private String languageCode;

    private List<Recipient> recipients;

    private SendOptions options;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Recipient {
        private String phone;
        private String email;
        private String userId;
        private String name;

        /**
         * Named variables: {"name": "Shreyash", "payment_link": "https://..."}
         * For WhatsApp, the service maps these to positional params using the template definition.
         * For Email, these replace {{key}} placeholders directly.
         */
        private Map<String, String> variables;

        /**
         * Email attachments (base64-encoded). Each entry: filename → base64 content.
         * Only used for EMAIL channel. Ignored for WhatsApp/Push.
         */
        private List<Attachment> attachments;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Attachment {
        private String filename;
        private String contentBase64; // base64-encoded file content
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendOptions {
        // Email options
        private String emailSubject;
        private String emailBody;
        private String emailType; // UTILITY_EMAIL, PROMOTIONAL_EMAIL, TRANSACTIONAL_EMAIL
        @JsonProperty("fromEmail")
        private String fromEmail;
        @JsonProperty("fromName")
        private String fromName;

        // WhatsApp options
        private String headerType; // image, video, document
        private String headerUrl;
        private Map<String, String> buttonUrlParams; // {"0": "https://..."}

        // Push notification options
        private String pushTitle;
        private String pushBody;
        private Map<String, String> pushData;

        // Rate limiting (optional — for bulk sends like announcements)
        private Integer rateLimitPerSecond;

        // General
        private String source;  // caller identifier for logging
        private String sourceId;
    }
}
