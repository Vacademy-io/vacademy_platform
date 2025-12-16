package vacademy.io.notification_service.features.combot.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * Request DTO for sending WhatsApp template message via Com.bot
 */
@Data
public class WhatsAppTemplateRequest {
    private String instituteId;
    private List<MessageInfo> messages;

    @Data
    public static class MessageInfo {
        private String userId;
        private Map<String, Object> payload; // Complete Meta API payload prepared by admin_core_service
    }
}
