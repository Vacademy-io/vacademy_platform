package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FlowAnalyticsDTO {
    private String flowId;
    private String flowName;
    private String status;
    private long totalSessions;
    private long activeSessions;
    private long completedSessions;
    private long errorSessions;
    private long timedOutSessions;
}
