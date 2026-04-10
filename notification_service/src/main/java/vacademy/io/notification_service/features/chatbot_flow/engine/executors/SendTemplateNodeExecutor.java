package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.engine.VariableResolver;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.ChatbotMessageProvider;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
public class SendTemplateNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;
    private final List<ChatbotMessageProvider> messageProviders;
    private final VariableResolver variableResolver;

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

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> variables = (List<Map<String, Object>>) config.get("variables");

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
            List<String> resolvedBodyParams = resolveBodyParams(bodyParams, variables, context);

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
                templatePayload.put("headerConfig", resolveHeaderConfig(headerConfig, variables, context));
            }
            if (buttonConfig != null) {
                templatePayload.put("buttonConfig", resolveButtonConfig(buttonConfig, variables, context));
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

    private List<String> resolveBodyParams(List<Map<String, Object>> bodyParams,
                                            List<Map<String, Object>> variables,
                                            FlowExecutionContext context) {
        if (bodyParams == null) return List.of();
        List<String> resolved = new ArrayList<>();
        // Sort by index
        bodyParams.sort(Comparator.comparingInt(p -> {
            Object idx = p.get("index");
            return idx instanceof Number ? ((Number) idx).intValue() : 0;
        }));
        for (Map<String, Object> param : bodyParams) {
            String value = (String) param.get("value");
            resolved.add(variableResolver.resolve(value, variables, context));
        }
        return resolved;
    }

    private Map<String, Object> resolveHeaderConfig(Map<String, Object> headerConfig,
                                                     List<Map<String, Object>> variables,
                                                     FlowExecutionContext context) {
        Map<String, Object> resolved = new LinkedHashMap<>(headerConfig);
        String url = (String) resolved.get("url");
        if (url != null) {
            resolved.put("url", variableResolver.resolve(url, variables, context));
        }
        return resolved;
    }

    private List<Map<String, Object>> resolveButtonConfig(List<Map<String, Object>> buttonConfig,
                                                           List<Map<String, Object>> variables,
                                                           FlowExecutionContext context) {
        List<Map<String, Object>> resolved = new ArrayList<>();
        for (Map<String, Object> btn : buttonConfig) {
            Map<String, Object> resolvedBtn = new LinkedHashMap<>(btn);
            String urlSuffix = (String) resolvedBtn.get("urlSuffix");
            if (urlSuffix != null) {
                resolvedBtn.put("urlSuffix", variableResolver.resolve(urlSuffix, variables, context));
            }
            resolved.add(resolvedBtn);
        }
        return resolved;
    }

    private ChatbotMessageProvider findProvider(String channelType) {
        return messageProviders.stream()
                .filter(p -> p.supports(channelType))
                .findFirst()
                .orElse(null);
    }

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
