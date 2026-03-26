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

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
@RequiredArgsConstructor
public class SendTemplateNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;
    private final List<ChatbotMessageProvider> messageProviders;

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(.+?)}}");

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.SEND_TEMPLATE.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid template config").build();
        }

        String templateName = (String) config.get("templateName");
        if (templateName == null || templateName.isBlank()) {
            return NodeExecutionResult.builder().success(false).errorMessage("No template name configured").build();
        }

        String languageCode = (String) config.getOrDefault("languageCode", "en");

        try {
            // Find the right provider for this channel type
            ChatbotMessageProvider provider = findProvider(context.getChannelType());
            if (provider == null) {
                return NodeExecutionResult.builder()
                        .success(false)
                        .errorMessage("No message provider for channel: " + context.getChannelType())
                        .build();
            }

            // Resolve body parameters
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> bodyParams = (List<Map<String, Object>>) config.get("bodyParams");
            List<String> resolvedBodyParams = resolveBodyParams(bodyParams, context);

            // Resolve header config
            @SuppressWarnings("unchecked")
            Map<String, Object> headerConfig = (Map<String, Object>) config.get("headerConfig");

            // Resolve button config
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> buttonConfig = (List<Map<String, Object>>) config.get("buttonConfig");

            // Build provider-agnostic template payload
            Map<String, Object> templatePayload = new LinkedHashMap<>();
            templatePayload.put("templateName", templateName);
            templatePayload.put("languageCode", languageCode);
            templatePayload.put("bodyParams", resolvedBodyParams);
            if (headerConfig != null) {
                templatePayload.put("headerConfig", resolveHeaderConfig(headerConfig, context));
            }
            if (buttonConfig != null) {
                templatePayload.put("buttonConfig", resolveButtonConfig(buttonConfig, context));
            }

            // Send via provider
            provider.sendTemplate(context.getPhoneNumber(), templatePayload,
                    context.getInstituteId(), context.getBusinessChannelId());

            log.info("Template sent: template={}, phone={}", templateName, context.getPhoneNumber());
            return NodeExecutionResult.builder().success(true).build();

        } catch (Exception e) {
            log.error("Failed to send template {}: {}", templateName, e.getMessage(), e);
            return NodeExecutionResult.builder()
                    .success(false)
                    .errorMessage("Failed to send template: " + e.getMessage())
                    .build();
        }
    }

    private List<String> resolveBodyParams(List<Map<String, Object>> bodyParams, FlowExecutionContext context) {
        if (bodyParams == null) return List.of();
        List<String> resolved = new ArrayList<>();
        // Sort by index
        bodyParams.sort(Comparator.comparingInt(p -> {
            Object idx = p.get("index");
            return idx instanceof Number ? ((Number) idx).intValue() : 0;
        }));
        for (Map<String, Object> param : bodyParams) {
            String value = (String) param.get("value");
            resolved.add(resolveVariable(value, context));
        }
        return resolved;
    }

    private Map<String, Object> resolveHeaderConfig(Map<String, Object> headerConfig, FlowExecutionContext context) {
        Map<String, Object> resolved = new LinkedHashMap<>(headerConfig);
        String url = (String) resolved.get("url");
        if (url != null) {
            resolved.put("url", resolveVariable(url, context));
        }
        return resolved;
    }

    private List<Map<String, Object>> resolveButtonConfig(List<Map<String, Object>> buttonConfig,
                                                           FlowExecutionContext context) {
        List<Map<String, Object>> resolved = new ArrayList<>();
        for (Map<String, Object> btn : buttonConfig) {
            Map<String, Object> resolvedBtn = new LinkedHashMap<>(btn);
            String urlSuffix = (String) resolvedBtn.get("urlSuffix");
            if (urlSuffix != null) {
                resolvedBtn.put("urlSuffix", resolveVariable(urlSuffix, context));
            }
            resolved.add(resolvedBtn);
        }
        return resolved;
    }

    /**
     * Resolve {{variable}} placeholders from context.
     * Supports: {{user.name}}, {{phone}}, {{session.varName}}, {{fixed:literal}}
     */
    private String resolveVariable(String template, FlowExecutionContext context) {
        if (template == null) return null;
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
        // Fixed literal: {{fixed:Welcome!}}
        if (varName.startsWith("fixed:")) {
            return varName.substring(6);
        }

        // Session variables: {{session.varName}}
        if (varName.startsWith("session.") && context.getSessionVariables() != null) {
            String key = varName.substring(8);
            Object val = context.getSessionVariables().get(key);
            return val != null ? val.toString() : "";
        }

        // User details: {{user.name}}, {{user.email}}
        if (varName.startsWith("user.") && context.getUserDetails() != null) {
            String key = varName.substring(5);
            Object val = context.getUserDetails().get(key);
            return val != null ? val.toString() : "";
        }

        // Direct context fields
        return switch (varName) {
            case "phone", "phoneNumber" -> context.getPhoneNumber() != null ? context.getPhoneNumber() : "";
            case "instituteId" -> context.getInstituteId() != null ? context.getInstituteId() : "";
            case "userId" -> context.getUserId() != null ? context.getUserId() : "";
            case "messageText" -> context.getMessageText() != null ? context.getMessageText() : "";
            default -> {
                // Check session variables as fallback
                if (context.getSessionVariables() != null) {
                    Object val = context.getSessionVariables().get(varName);
                    if (val != null) yield val.toString();
                }
                yield "";
            }
        };
    }

    private ChatbotMessageProvider findProvider(String channelType) {
        return messageProviders.stream()
                .filter(p -> p.supports(channelType))
                .findFirst()
                .orElse(null);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse template config: {}", e.getMessage());
            return null;
        }
    }
}
