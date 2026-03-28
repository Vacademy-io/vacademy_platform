package vacademy.io.notification_service.features.send.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendBatchSummaryDTO {
    private String id;
    private String channel;
    private String templateName;
    private int totalRecipients;
    private int sentCount;
    private int failedCount;
    private String status;
    private String source;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
