package vacademy.io.notification_service.features.chatbot_flow.engine;

import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;

public interface ChatbotNodeExecutor {

    boolean canHandle(String nodeType);

    NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                String userText, FlowExecutionContext context);
}
