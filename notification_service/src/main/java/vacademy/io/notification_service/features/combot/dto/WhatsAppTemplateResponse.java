package vacademy.io.notification_service.features.combot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Response DTO for WhatsApp template message sending
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppTemplateResponse {
    private Boolean success;
    private String message;
    private String instituteId;
    private Integer total;
    private Integer successCount;
    private Integer failureCount;
    private List<MessageResult> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageResult {
        private String phone;
        private Boolean success;
        private String queueId;
        private String status;
        private String error;
        private Map<String, Object> fullResponse;
    }
}
