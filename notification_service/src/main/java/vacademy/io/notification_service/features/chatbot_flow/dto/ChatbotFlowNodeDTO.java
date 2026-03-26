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
public class ChatbotFlowNodeDTO {
    private String id;
    private String nodeType;
    private String name;
    private Map<String, Object> config;
    private double positionX;
    private double positionY;
}
