package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatReportResponse {
    private String id;
    private String instituteId;
    private String conversationId;
    private String messageId;
    private String reporterId;
    private String reason;
    private String details;
    private String status;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    // Only the reported message's content is exposed (never arbitrary DM history).
    private ChatMessageResponse reportedMessage;
}
