package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

@Data
public class ReviewReportRequest {
    private String status; // ChatReportStatus: REVIEWING | ACTIONED | DISMISSED
}
