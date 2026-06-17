package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

@Data
public class CreateReportRequest {
    private String conversationId;
    private String messageId; // nullable: report a whole conversation
    private String reason;    // ChatReportReason
    private String details;
}
