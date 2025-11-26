package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserAnnouncementPreferenceResponse {

    private String username;
    private PreferenceSettings settings;
    private AvailableSenders availableSenders;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreferenceSettings {
        private EmailPreference email;
        private WhatsAppPreference whatsapp;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailPreference {
        private Boolean globallyUnsubscribed;
        private List<EmailSenderPreference> senders;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailSenderPreference {
        private String fromAddress;
        private String emailType;
        private Boolean unsubscribed;
        private LocalDateTime unsubscribedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WhatsAppPreference {
        private Boolean unsubscribed;
        private LocalDateTime unsubscribedAt;
        private String senderIdentifier;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AvailableSenders {
        private List<EmailSenderOption> emailSenders;
        private String whatsappSenderIdentifier;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailSenderOption {
        private String emailType;
        private String fromAddress;
    }
}

