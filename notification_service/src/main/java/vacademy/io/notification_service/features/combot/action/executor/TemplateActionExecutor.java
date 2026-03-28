package vacademy.io.notification_service.features.combot.action.executor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.CombotMessageProvider;
import vacademy.io.notification_service.features.combot.action.dto.FlowAction;
import vacademy.io.notification_service.features.combot.action.dto.FlowContext;
import vacademy.io.notification_service.features.combot.action.dto.TemplateAction;

import java.util.*;

/**
 * Executor for TEMPLATE actions in the legacy state machine (channel_flow_config).
 * Now delegates to CombotMessageProvider instead of CombotMessagingService.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TemplateActionExecutor implements FlowActionExecutor {

    private final CombotMessageProvider combotMessageProvider;

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
            // Build templatePayload for CombotMessageProvider
            Map<String, Object> templatePayload = new HashMap<>();
            templatePayload.put("templateName", templateAction.getTemplateName());
            templatePayload.put("languageCode", "en");

            // Resolve and add body parameters
            List<String> params = templateAction.getParams();
            if (params != null && !params.isEmpty()) {
                List<String> resolvedParams = new ArrayList<>();
                for (String param : params) {
                    resolvedParams.add(resolveParamValue(param, context));
                }
                templatePayload.put("bodyParams", resolvedParams);
            }

            // Delegate to provider (handles COMBOT and META)
            combotMessageProvider.sendTemplate(
                    context.getPhoneNumber(),
                    templatePayload,
                    context.getInstituteId(),
                    context.getBusinessChannelId());

            log.info("Template action sent successfully: templateName={}, phone={}",
                    templateAction.getTemplateName(), context.getPhoneNumber());

        } catch (Exception e) {
            log.error("Failed to execute template action: templateName={}, phone={}, error={}",
                    templateAction.getTemplateName(), context.getPhoneNumber(), e.getMessage(), e);
        }
    }

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
