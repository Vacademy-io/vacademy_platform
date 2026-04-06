package vacademy.io.admin_core_service.features.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotAiResponse {
    private String assistantMessage;
    private int promptTokens;
    private int completionTokens;
    private boolean exitIntent;
}
