package vacademy.io.notification_service.features.announcements.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserAnnouncementPreferenceUpdateRequest {

    @NotBlank(message = "Username must not be blank")
    private String username;

    private String instituteId;

    @Valid
    private PreferenceUpdate preferences;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreferenceUpdate {
        private List<EmailSenderUpdate> emailSenders;
        private Boolean whatsappUnsubscribed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailSenderUpdate {
        @NotBlank(message = "Email type must not be blank")
        private String emailType;
        private Boolean unsubscribed;
    }
}

