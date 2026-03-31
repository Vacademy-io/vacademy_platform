package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.ChatbotMessageProvider;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sends free-form session messages (text, image, video, document, audio).
 * No pre-approved template needed — works within the 24-hour session window
 * (which is always open because chatbot flows trigger on incoming messages).
 *
 * Config JSON:
 * {
 *   "messageType": "text|image|video|document|audio",
 *   "text": "Hello {{user.name}}! Welcome.",
 *   "mediaUrl": "https://example.com/image.jpg",
 *   "mediaCaption": "Check this out!",
 *   "filename": "brochure.pdf"
 * }
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SendMessageNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;
    private final List<ChatbotMessageProvider> messageProviders;

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(.+?)}}");

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.SEND_MESSAGE.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid message config").build();
        }

        String messageType = (String) config.getOrDefault("messageType", "text");

        try {
            ChatbotMessageProvider provider = messageProviders.stream()
                    .filter(p -> p.supports(context.getChannelType()))
                    .findFirst().orElse(null);

            if (provider == null) {
                return NodeExecutionResult.builder()
                        .success(false)
                        .errorMessage("No provider for channel: " + context.getChannelType())
                        .build();
            }

            if ("text".equals(messageType)) {
                String text = (String) config.getOrDefault("text", "");
                String resolved = resolveVariables(text, context);
                provider.sendText(context.getPhoneNumber(), resolved,
                        context.getInstituteId(), context.getBusinessChannelId());
                log.info("Session text message sent to {}", context.getPhoneNumber());

            } else {
                // Media message: image, video, document, audio
                String mediaUrl = resolveVariables((String) config.getOrDefault("mediaUrl", ""), context);
                String caption = resolveVariables((String) config.getOrDefault("mediaCaption", ""), context);
                String filename = (String) config.get("filename");

                if (mediaUrl.isBlank()) {
                    return NodeExecutionResult.builder()
                            .success(false)
                            .errorMessage("Media URL is required for " + messageType + " messages")
                            .build();
                }

                provider.sendMedia(context.getPhoneNumber(), messageType, mediaUrl, caption,
                        filename, context.getInstituteId(), context.getBusinessChannelId());
                log.info("Session {} message sent to {}", messageType, context.getPhoneNumber());
            }

            return NodeExecutionResult.builder().success(true).build();

        } catch (Exception e) {
            log.error("Failed to send session message: {}", e.getMessage(), e);
            return NodeExecutionResult.builder()
                    .success(false)
                    .errorMessage("Send failed: " + e.getMessage())
                    .build();
        }
    }

    private String resolveVariables(String template, FlowExecutionContext context) {
        if (template == null || template.isBlank()) return template;
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1).trim();
            String replacement = lookupVariable(varName, context);
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private String lookupVariable(String varName, FlowExecutionContext context) {
        if (varName.startsWith("fixed:")) return varName.substring(6);
        if (varName.startsWith("session.") && context.getSessionVariables() != null) {
            Object val = context.getSessionVariables().get(varName.substring(8));
            return val != null ? val.toString() : "";
        }
        if (varName.startsWith("user.") && context.getUserDetails() != null) {
            Object val = context.getUserDetails().get(varName.substring(5));
            return val != null ? val.toString() : "";
        }
        return switch (varName) {
            case "phone", "phoneNumber" -> context.getPhoneNumber() != null ? context.getPhoneNumber() : "";
            case "instituteId" -> context.getInstituteId() != null ? context.getInstituteId() : "";
            case "messageText" -> context.getMessageText() != null ? context.getMessageText() : "";
            default -> {
                if (context.getSessionVariables() != null) {
                    Object val = context.getSessionVariables().get(varName);
                    if (val != null) yield val.toString();
                }
                yield "";
            }
        };
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
