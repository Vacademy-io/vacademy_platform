package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatbotFlowEdgeDTO {
    private String id;
    private String sourceNodeId;
    private String targetNodeId;
    private String conditionLabel;
    private Map<String, Object> conditionConfig;
    private int sortOrder;
}
