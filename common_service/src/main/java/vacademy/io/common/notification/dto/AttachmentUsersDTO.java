package vacademy.io.common.notification.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AttachmentUsersDTO {
    private Map<String, String> placeholders;
    private String attachment; // Base64 encoded string
    private String channelId;
    private String userId;
}
