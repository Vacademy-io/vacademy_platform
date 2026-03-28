package vacademy.io.notification_service.features.events.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.notification_service.features.send.dto.UnifiedSendResponse;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEventResponse {

    private String eventType;
    private int totalSends;
    private int completedSends;
    private int failedSends;

    /** Per-send results (one per EventSend in the request) */
    private List<UnifiedSendResponse> sendResults;
}
