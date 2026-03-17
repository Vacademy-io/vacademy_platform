package vacademy.io.notification_service.features.combot.action.executor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.combot.action.dto.FlowAction;
import vacademy.io.notification_service.features.combot.action.dto.FlowContext;
import vacademy.io.notification_service.features.combot.action.dto.TemplateAction;
import vacademy.io.notification_service.features.combot.dto.WhatsAppTemplateRequest;
import vacademy.io.notification_service.features.combot.service.CombotMessagingService;

import java.util.*;

/**
 * Executor for TEMPLATE actions.
 * Sends a WhatsApp template message via CombotMessagingService.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TemplateActionExecutor implements FlowActionExecutor {

    @Autowired
    @Lazy
    private CombotMessagingService messagingService;

    @Override
    public boolean canHandle(FlowAction action) {
        return action instanceof TemplateAction;
    }

    @Override
    public void execute(FlowAction action, FlowContext context) {
        TemplateAction templateAction = (TemplateAction) action;

        log.info("Executing template action: templateName={}, phone={}, instituteId={}",
                templateAction.getTemplateName(),
                context.getPhoneNumber(),
                context.getInstituteId());

        try {
            WhatsAppTemplateRequest request = new WhatsAppTemplateRequest();
            request.setInstituteId(context.getInstituteId());

            WhatsAppTemplateRequest.MessageInfo msg = new WhatsAppTemplateRequest.MessageInfo();
            msg.setUserId(context.getUserId());

            Map<String, Object> payload = new HashMap<>();
            payload.put("messaging_product", "whatsapp");
            payload.put("to", context.getPhoneNumber());
            payload.put("type", "template");

            Map<String, Object> template = new HashMap<>();
            template.put("name", templateAction.getTemplateName());
            template.put("language", Map.of("code", "en"));

            // Resolve and add parameters if present
            List<String> params = templateAction.getParams();
            if (params != null && !params.isEmpty()) {
                List<String> resolvedParams = new ArrayList<>();
                for (String param : params) {
                    resolvedParams.add(resolveParamValue(param, context));
                }

                List<Map<String, Object>> components = new ArrayList<>();
                Map<String, Object> bodyComponent = new HashMap<>();
                bodyComponent.put("type", "body");

                List<Map<String, String>> parameters = new ArrayList<>();
                for (String paramVal : resolvedParams) {
                    parameters.add(Map.of("type", "text", "text", paramVal));
                }
                bodyComponent.put("parameters", parameters);
                components.add(bodyComponent);

                template.put("components", components);
            }

            payload.put("template", template);
            msg.setPayload(payload);
            request.setMessages(List.of(msg));

            messagingService.sendTemplateMessages(request);

            log.info("Template action sent successfully: templateName={}, phone={}",
                    templateAction.getTemplateName(), context.getPhoneNumber());

        } catch (Exception e) {
            log.error("Failed to execute template action: templateName={}, phone={}, error={}",
                    templateAction.getTemplateName(), context.getPhoneNumber(), e.getMessage(), e);
        }
    }

    /**
     * Resolve parameter value - supports {{fieldName}} placeholders.
     */
    private String resolveParamValue(String value, FlowContext context) {
        if (value == null) return "";

        if (value.startsWith("{{") && value.endsWith("}}")) {
            String fieldName = value.substring(2, value.length() - 2);
            return switch (fieldName) {
                case "phoneNumber" -> safeGet(context.getPhoneNumber());
                case "userId" -> safeGet(context.getUserId());
                case "instituteId" -> safeGet(context.getInstituteId());
                case "messageText" -> safeGet(context.getMessageText());
                case "businessChannelId" -> safeGet(context.getBusinessChannelId());
                default -> {
                    // Try to resolve from userDetails
                    if (context.getUserDetails() != null && context.getUserDetails().containsKey(fieldName)) {
                        yield String.valueOf(context.getUserDetails().get(fieldName));
                    }
                    yield value;
                }
            };
        }

        return value;
    }

    private String safeGet(String value) {
        return value != null ? value : "";
    }
}
