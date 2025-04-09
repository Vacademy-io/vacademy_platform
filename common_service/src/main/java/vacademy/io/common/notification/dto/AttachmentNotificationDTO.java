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
}