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
public class ChatbotFlowDTO {
    private String id;
    private String instituteId;
    private String name;
    private String description;
    private String channelType;
    private String status;
    private int version;
    private Map<String, Object> triggerConfig;
    private Map<String, Object> settings;
    private String createdBy;
    private String createdAt;
    private String updatedAt;

    private List<ChatbotFlowNodeDTO> nodes;
    private List<ChatbotFlowEdgeDTO> edges;
}
