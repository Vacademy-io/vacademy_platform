package vacademy.io.admin_core_service.features.agent.dto;

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
public class ChatbotAiRequest {
    private String instituteId;
    private String modelId;
    private String systemPrompt;
    private List<Map<String, String>> conversationHistory;
    private String userMessage;
    private int maxTokens;
    private double temperature;
}
