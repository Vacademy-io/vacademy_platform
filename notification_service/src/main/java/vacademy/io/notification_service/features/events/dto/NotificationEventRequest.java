package vacademy.io.notification_service.features.events.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Fired by admin-core when a notification-worthy event occurs.
 * Contains pre-resolved sends — notification service just executes them.
 *
 * Example: LEARNER_ENROLL fires with sends = [
 *   {channel: WHATSAPP, templateName: "welcome_whatsapp", recipients: [{phone: "919...", variables: {...}}]},
 *   {channel: EMAIL, templateName: "welcome_email", recipients: [{email: "user@...", variables: {...}}]}
 * ]
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEventRequest {

    private String eventType;       // e.g. LEARNER_ENROLL, PAYMENT_SUCCESS
    private String instituteId;
    private String sourceType;      // BATCH, INSTITUTE, USER
    private String sourceId;        // package-session-id, institute-id, etc.

    /**
     * Pre-resolved sends. Admin-core looks up NotificationEventConfig,
     * resolves channels + templates, and passes them here.
     * Notification service just executes each send.
     */
    private List<EventSend> sends;

    /**
     * Optional: extra context for logging/auditing.
     */
    private Map<String, String> metadata;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventSend {
        private String channel;         // WHATSAPP, EMAIL, PUSH
        private String templateName;    // WhatsApp template name or email template ID
        private String languageCode;

        private List<EventRecipient> recipients;

        // Optional channel-specific options
        private String emailSubject;
        private String emailBody;
        private String emailType;
        private String headerType;
        private String headerUrl;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventRecipient {
        private String phone;
        private String email;
        private String userId;
        private String name;
        private Map<String, String> variables;
    }
}
