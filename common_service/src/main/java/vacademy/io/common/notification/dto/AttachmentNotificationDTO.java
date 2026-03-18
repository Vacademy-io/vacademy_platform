package vacademy.io.common.notification.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AttachmentNotificationDTO {
    private String body;
    private String notificationType;
    private String subject;
    private String source;
    private String sourceId;
    private List<AttachmentUsersDTO> users;
    private String attachmentName;
    private String emailType; // Email type to use (e.g., UTILITY_EMAIL, MARKETING_EMAIL)

    // Explicit getter for emailType to ensure it's available during compilation
    public String getEmailType() {
        return emailType;
    }

    public void setEmailType(String emailType) {
        this.emailType = emailType;
    }
}