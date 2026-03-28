package vacademy.io.admin_core_service.features.notification.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Mirrors notification-service's UnifiedSendRequest.
 * Single DTO for sending WhatsApp, Email, Push, or System Alert.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedSendRequest {

    private String instituteId;
    private String channel; // WHATSAPP, EMAIL, PUSH, SYSTEM_ALERT
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
        private Map<String, String> variables;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendOptions {
        private String emailSubject;
        private String emailBody;
        private String emailType;
        @JsonProperty("fromEmail")
        private String fromEmail;
        @JsonProperty("fromName")
        private String fromName;
        private String headerType;
        private String headerUrl;
        private Map<String, String> buttonUrlParams;
        private String pushTitle;
        private String pushBody;
        private Map<String, String> pushData;
        private String source;
        private String sourceId;
    }
}
