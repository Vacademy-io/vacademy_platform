package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatbotFlowSessionDTO {
    private String id;
    private String flowId;
    private String flowName;
    private String instituteId;
    private String userPhone;
    private String userId;
    private String currentNodeId;
    private String currentNodeName;
    private String currentNodeType;
    private String status;
    private Map<String, Object> context;
    private String startedAt;
    private String lastActivityAt;
    private String completedAt;

    /** Message history from notification_log for this session's user */
    private List<SessionMessage> messages;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionMessage {
        private String id;
        private String type;        // WHATSAPP_MESSAGE_OUTGOING, WHATSAPP_MESSAGE_INCOMING
        private String body;
        private String source;      // COMBOT, WATI, META
        private String timestamp;
        private String direction;   // OUTGOING, INCOMING
    }
}
