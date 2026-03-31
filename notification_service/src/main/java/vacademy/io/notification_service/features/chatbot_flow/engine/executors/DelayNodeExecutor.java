package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.sql.Timestamp;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
public class DelayNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.DELAY.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid delay config").build();
        }

        int delayValue = config.get("delayValue") instanceof Number
                ? ((Number) config.get("delayValue")).intValue() : 0;
        String delayUnit = (String) config.getOrDefault("delayUnit", "MINUTES");

        long delayMs = switch (delayUnit.toUpperCase()) {
            case "SECONDS" -> delayValue * 1000L;
            case "MINUTES" -> delayValue * 60_000L;
            case "HOURS" -> delayValue * 3_600_000L;
            case "DAYS" -> delayValue * 86_400_000L;
            default -> delayValue * 60_000L;
        };

        Timestamp fireAt = new Timestamp(System.currentTimeMillis() + delayMs);
        log.info("Delay node: scheduling resume at {} ({}{})", fireAt, delayValue, delayUnit);

        return NodeExecutionResult.builder()
                .success(true)
                .scheduleDelay(true)
                .delayUntil(fireAt)
                .build();
    }

    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
