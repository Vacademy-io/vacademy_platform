package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.ChatbotMessageProvider;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.util.*;

@Component
@Slf4j
@RequiredArgsConstructor
public class AiResponseNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;
    private final InternalClientUtils internalClientUtils;
    private final List<ChatbotMessageProvider> messageProviders;

    @Value("${admin.core.service.baseurl:http://localhost:8081}")
    private String adminCoreServiceUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.AI_RESPONSE.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid AI config").build();
        }

        // Check exit keywords
        @SuppressWarnings("unchecked")
        List<String> exitKeywords = (List<String>) config.getOrDefault("exitKeywords", List.of());
        if (userText != null && !exitKeywords.isEmpty()) {
            String lower = userText.trim().toLowerCase();
            boolean isExit = exitKeywords.stream().anyMatch(k -> lower.contains(k.toLowerCase()));
            if (isExit) {
                log.info("AI exit keyword detected: {}", userText);
                return NodeExecutionResult.builder()
                        .success(true)
                        .waitForInput(false) // Exit AI mode, advance to next node
                        .build();
            }
        }

        // Check max turns
        int maxTurns = config.get("maxTurns") instanceof Number
                ? ((Number) config.get("maxTurns")).intValue() : 10;
        int currentTurns = getAiTurnCount(context.getSessionVariables());
        if (currentTurns >= maxTurns) {
            log.info("AI max turns reached: {}/{}", currentTurns, maxTurns);
            String fallbackMessage = (String) config.getOrDefault("fallbackMessage",
                    "Let me connect you with a human agent.");
            sendTextToUser(context, fallbackMessage);
            return NodeExecutionResult.builder().success(true).waitForInput(false).build();
        }

        if (userText == null || userText.isBlank()) {
            // First time arriving at AI node — wait for user input
            return NodeExecutionResult.builder().success(true).waitForInput(true).build();
        }

        try {
            // Build conversation history from session context
            @SuppressWarnings("unchecked")
            List<Map<String, String>> history = context.getSessionVariables() != null
                    ? (List<Map<String, String>>) context.getSessionVariables().getOrDefault("ai_history", new ArrayList<>())
                    : new ArrayList<>();

            // Call admin-core-service AI endpoint
            String modelId = (String) config.getOrDefault("modelId", "google/gemini-2.0-flash-001");
            String userSystemPrompt = (String) config.getOrDefault("systemPrompt", "You are a helpful assistant.");
            int maxTokens = config.get("maxTokens") instanceof Number
                    ? ((Number) config.get("maxTokens")).intValue() : 500;
            double temperature = config.get("temperature") instanceof Number
                    ? ((Number) config.get("temperature")).doubleValue() : 0.7;

            // Inject WhatsApp context so the LLM knows its output goes directly as a message
            String systemPrompt = userSystemPrompt + "\n\n"
                    + "IMPORTANT CONTEXT: Your response will be sent directly as a WhatsApp message to the user. "
                    + "Keep it concise and conversational. No explanations, no meta-commentary, no markdown headers. "
                    + "Do not say things like 'Here is my response' or 'This translates to'. "
                    + "Just reply naturally as if you are chatting on WhatsApp. "
                    + "Use WhatsApp formatting if needed: *bold*, _italic_. Keep responses under 300 characters when possible.";

            Map<String, Object> aiRequest = new LinkedHashMap<>();
            aiRequest.put("instituteId", context.getInstituteId());
            aiRequest.put("modelId", modelId);
            aiRequest.put("systemPrompt", systemPrompt);
            aiRequest.put("conversationHistory", history);
            aiRequest.put("userMessage", userText);
            aiRequest.put("maxTokens", maxTokens);
            aiRequest.put("temperature", temperature);

            String endpoint = "/admin-core-service/internal/chatbot-ai/respond";

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.POST.name(), adminCoreServiceUrl, endpoint, aiRequest);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> responseBody = objectMapper.readValue(response.getBody(), Map.class);
                String assistantMessage = (String) responseBody.get("assistantMessage");

                // Send AI reply to user via WhatsApp
                if (assistantMessage != null && !assistantMessage.isBlank()) {
                    sendTextToUser(context, assistantMessage);
                }

                // Update conversation history in session
                List<Map<String, String>> updatedHistory = new ArrayList<>(history);
                updatedHistory.add(Map.of("role", "user", "content", userText));
                if (assistantMessage != null) {
                    updatedHistory.add(Map.of("role", "assistant", "content", assistantMessage));
                }

                Map<String, Object> outputVars = new HashMap<>();
                outputVars.put("ai_history", updatedHistory);
                outputVars.put("ai_turns", currentTurns + 1);
                outputVars.put("ai_last_response", assistantMessage);

                return NodeExecutionResult.builder()
                        .success(true)
                        .waitForInput(true) // Stay in AI conversation mode
                        .outputVariables(outputVars)
                        .build();
            }

            return NodeExecutionResult.builder()
                    .success(false)
                    .errorMessage("AI service returned non-success")
                    .build();

        } catch (Exception e) {
            log.error("AI response failed: {}", e.getMessage(), e);
            String fallbackMessage = (String) config.getOrDefault("fallbackMessage",
                    "I'm having trouble understanding. Let me connect you with a human agent.");
            sendTextToUser(context, fallbackMessage);
            return NodeExecutionResult.builder()
                    .success(true)
                    .waitForInput(false) // Exit AI mode on error
                    .build();
        }
    }

    private int getAiTurnCount(Map<String, Object> sessionVars) {
        if (sessionVars == null) return 0;
        Object turns = sessionVars.get("ai_turns");
        return turns instanceof Number ? ((Number) turns).intValue() : 0;
    }

    private void sendTextToUser(FlowExecutionContext context, String text) {
        ChatbotMessageProvider provider = messageProviders.stream()
                .filter(p -> p.supports(context.getChannelType()))
                .findFirst().orElse(null);
        if (provider != null) {
            provider.sendText(context.getPhoneNumber(), text,
                    context.getInstituteId(), context.getBusinessChannelId());
        }
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
