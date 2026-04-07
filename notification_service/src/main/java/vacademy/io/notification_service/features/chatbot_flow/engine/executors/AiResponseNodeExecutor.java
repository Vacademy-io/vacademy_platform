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

        // Enrich user text with button/list selection context
        if (userText != null && context.getButtonId() != null) {
            userText = userText + " [selected: " + context.getButtonId() + "]";
        } else if (userText != null && context.getListReplyId() != null) {
            userText = userText + " [selected: " + context.getListReplyId() + "]";
        }

        if (userText == null || userText.isBlank()) {
            // First time arriving at AI node with no text — use a default greeting
            // so the AI initiates the conversation instead of waiting silently
            userText = "Hello";
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

            boolean enableInteractive = Boolean.TRUE.equals(config.get("enableInteractive"));

            // Inject WhatsApp context so the LLM knows its output goes directly as a message
            String whatsappContext = "\n\nIMPORTANT CONTEXT: Your response will be sent directly as a WhatsApp message to the user. "
                    + "Keep it concise and conversational. No explanations, no meta-commentary, no markdown headers. "
                    + "Do not say things like 'Here is my response' or 'This translates to'. "
                    + "Just reply naturally as if you are chatting on WhatsApp. "
                    + "Use WhatsApp formatting if needed: *bold*, _italic_. Keep responses under 300 characters when possible.";

            if (enableInteractive) {
                whatsappContext += "\n\nINTERACTIVE WHATSAPP ELEMENTS:\n"
                        + "When presenting clear choices to the user, you may include interactive UI elements. "
                        + "To do so, respond with a JSON object (and NOTHING else outside the JSON):\n\n"
                        + "For reply buttons (2-3 discrete choices):\n"
                        + "{\"text\":\"Your message here\",\"interactive\":{\"type\":\"button\",\"buttons\":[{\"id\":\"btn_id\",\"title\":\"Label (max 20 chars)\"}]}}\n\n"
                        + "For list menus (4+ options, optionally grouped):\n"
                        + "{\"text\":\"Your message here\",\"interactive\":{\"type\":\"list\",\"buttonText\":\"Menu Label\",\"sections\":[{\"title\":\"Section\",\"rows\":[{\"id\":\"row_id\",\"title\":\"Max 24 chars\",\"description\":\"Optional detail\"}]}]}}\n\n"
                        + "Rules:\n"
                        + "- Max 3 buttons, each title max 20 characters.\n"
                        + "- Max 10 list rows total, each title max 24 characters.\n"
                        + "- The \"text\" field must be a complete, meaningful standalone message.\n"
                        + "- Only use interactive elements when presenting clear choices. For conversational replies, just respond with plain text (NO JSON wrapping).\n"
                        + "- Button/row IDs should be short, descriptive, lowercase with underscores.\n"
                        + "- NEVER wrap plain text responses in JSON.\n";
            }

            String systemPrompt = userSystemPrompt + whatsappContext;

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

                // Send AI reply — parse for interactive elements if enabled
                String displayText = assistantMessage;
                if (assistantMessage != null && !assistantMessage.isBlank()) {
                    displayText = parseAndSendAiResponse(context, assistantMessage, enableInteractive);
                }

                // Update conversation history — store clean text, not raw JSON
                List<Map<String, String>> updatedHistory = new ArrayList<>(history);
                updatedHistory.add(Map.of("role", "user", "content", userText));
                if (displayText != null) {
                    updatedHistory.add(Map.of("role", "assistant", "content", displayText));
                }

                Map<String, Object> outputVars = new HashMap<>();
                outputVars.put("ai_history", updatedHistory);
                outputVars.put("ai_turns", currentTurns + 1);
                outputVars.put("ai_last_response", displayText);

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

    /**
     * Parse AI response for interactive elements. Returns the display text
     * (plain text portion) for history storage.
     */
    @SuppressWarnings("unchecked")
    private String parseAndSendAiResponse(FlowExecutionContext ctx, String msg, boolean interactive) {
        if (!interactive || msg == null || !msg.trim().startsWith("{")) {
            sendTextToUser(ctx, msg);
            return msg;
        }

        try {
            Map<String, Object> parsed = objectMapper.readValue(msg.trim(), new TypeReference<>() {});
            String text = (String) parsed.get("text");
            Map<String, Object> interactiveData = (Map<String, Object>) parsed.get("interactive");

            if (text == null || text.isBlank()) {
                sendTextToUser(ctx, msg);
                return msg;
            }
            if (interactiveData == null) {
                sendTextToUser(ctx, text);
                return text;
            }

            // Build payload matching ChatbotMessageProvider.sendInteractive() format
            String type = (String) interactiveData.getOrDefault("type", "button");
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("interactiveType", type);
            payload.put("body", text);

            if ("button".equals(type)) {
                List<Map<String, Object>> buttons = (List<Map<String, Object>>) interactiveData.get("buttons");
                payload.put("buttons", sanitizeButtons(buttons));
            } else if ("list".equals(type)) {
                payload.put("listButtonText", interactiveData.getOrDefault("buttonText", "Select"));
                payload.put("sections", sanitizeSections(
                        (List<Map<String, Object>>) interactiveData.get("sections")));
            }

            sendInteractiveToUser(ctx, payload, text);
            return text;

        } catch (Exception e) {
            log.warn("AI interactive parse failed, falling back to text: {}", e.getMessage());
            sendTextToUser(ctx, msg);
            return msg;
        }
    }

    private List<Map<String, Object>> sanitizeButtons(List<Map<String, Object>> buttons) {
        if (buttons == null || buttons.isEmpty()) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < Math.min(buttons.size(), 3); i++) {
            Map<String, Object> btn = new LinkedHashMap<>(buttons.get(i));
            String title = btn.getOrDefault("title", "").toString();
            if (title.length() > 20) btn.put("title", title.substring(0, 20));
            String id = btn.getOrDefault("id", "btn_" + i).toString();
            if (id.isBlank()) btn.put("id", "btn_" + i);
            btn.put("id", id);
            result.add(btn);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> sanitizeSections(List<Map<String, Object>> sections) {
        if (sections == null || sections.isEmpty()) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        int totalRows = 0;
        for (Map<String, Object> section : sections) {
            Map<String, Object> sanitized = new LinkedHashMap<>(section);
            List<Map<String, Object>> rows = (List<Map<String, Object>>) section.getOrDefault("rows", List.of());
            List<Map<String, Object>> sanitizedRows = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                if (totalRows >= 10) break;
                Map<String, Object> r = new LinkedHashMap<>(row);
                String title = r.getOrDefault("title", "").toString();
                if (title.length() > 24) r.put("title", title.substring(0, 24));
                String desc = r.getOrDefault("description", "").toString();
                if (desc.length() > 72) r.put("description", desc.substring(0, 72));
                String id = r.getOrDefault("id", "row_" + totalRows).toString();
                if (id.isBlank()) r.put("id", "row_" + totalRows);
                sanitizedRows.add(r);
                totalRows++;
            }
            sanitized.put("rows", sanitizedRows);
            result.add(sanitized);
        }
        return result;
    }

    private void sendInteractiveToUser(FlowExecutionContext ctx, Map<String, Object> payload, String fallbackText) {
        ChatbotMessageProvider provider = messageProviders.stream()
                .filter(p -> p.supports(ctx.getChannelType()))
                .findFirst().orElse(null);
        if (provider == null) return;
        try {
            provider.sendInteractive(ctx.getPhoneNumber(), payload,
                    ctx.getInstituteId(), ctx.getBusinessChannelId());
        } catch (Exception e) {
            log.warn("sendInteractive failed, falling back to text: {}", e.getMessage());
            provider.sendText(ctx.getPhoneNumber(), fallbackText,
                    ctx.getInstituteId(), ctx.getBusinessChannelId());
        }
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
