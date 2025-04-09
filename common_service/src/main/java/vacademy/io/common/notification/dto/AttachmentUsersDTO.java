package vacademy.io.common.notification.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AttachmentUsersDTO {
    private Map<String, String> placeholders;
    private List<AttachmentDTO> attachments; // Base64 encoded string
    private String channelId;
    private String userId;

    @Data
    public static class AttachmentDTO {
        private String attachmentName;
        private String attachment;
    }

}