package vacademy.io.admin_core_service.features.workflow.engine.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategy;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class SendWhatsAppProcessorStrategy implements DataProcessorStrategy {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean canHandle(String operation) {
        return "SEND_WHATSAPP".equalsIgnoreCase(operation);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext) {
        Map<String, Object> changes = new HashMap<>();

        try {
            ForEachConfigDTO forEachConfig = objectMapper.convertValue(config, ForEachConfigDTO.class);

            // Get the 'on' expression to evaluate templates
            String onExpr = forEachConfig.getOn();
            if (onExpr == null || onExpr.isBlank()) {
                log.warn("SEND_WHATSAPP operation missing 'on' expression");
                changes.put("status", "missing_on_expression");
                return changes;
            }

            // Evaluate the templates expression
            Object templatesObj = spelEvaluator.eval(onExpr, itemContext);
            if (templatesObj == null) {
                log.warn("No templates found for expression: {}", onExpr);
                changes.put("status", "no_templates_found");
                return changes;
            }

            // Process templates and create WhatsApp requests
            List<Map<String, Object>> whatsappRequests = processTemplatesAndCreateRequests(
                    templatesObj, itemContext, forEachConfig);

            if (!whatsappRequests.isEmpty()) {
                changes.put("whatsapp_requests", whatsappRequests);
                changes.put("request_count", whatsappRequests.size());
                changes.put("status", "requests_created");

                log.info("Created {} WhatsApp requests for item: {}", whatsappRequests.size(), itemContext.get("item"));
            } else {
                changes.put("status", "no_requests_created");
            }

        } catch (Exception e) {
            log.error("Error executing SendWhatsApp processor", e);
            changes.put("status", "error");
            changes.put("error", e.getMessage());
        }

        return changes;
    }

    private List<Map<String, Object>> processTemplatesAndCreateRequests(
            Object templatesObj,
            Map<String, Object> itemContext,
            ForEachConfigDTO forEachConfig) {

        List<Map<String, Object>> requests = new ArrayList<>();

        try {
            if (templatesObj instanceof List) {
                // Handle list of templates
                List<?> templates = (List<?>) templatesObj;
                for (Object template : templates) {
                    Map<String, Object> request = createWhatsAppRequest(template, itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else if (templatesObj instanceof Map) {
                // Handle map of templates
                Map<?, ?> templates = (Map<?, ?>) templatesObj;
                for (Map.Entry<?, ?> entry : templates.entrySet()) {
                    Map<String, Object> request = createWhatsAppRequest(entry.getValue(), itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else {
                // Handle single template
                Map<String, Object> request = createWhatsAppRequest(templatesObj, itemContext, forEachConfig);
                if (request != null) {
                    requests.add(request);
                }
            }
        } catch (Exception e) {
            log.error("Error processing templates", e);
        }

        return requests;
    }

    private Map<String, Object> createWhatsAppRequest(Object template, Map<String, Object> itemContext,
            ForEachConfigDTO forEachConfig) {
        try {
            Map<String, Object> item = (Map<String, Object>) itemContext.get("item");
            if (item == null) {
                log.warn("No item found in context");
                return null;
            }

            // Extract mobile number
            String mobileNumber = extractMobileNumber(item);
            if (mobileNumber == null || mobileNumber.isBlank()) {
                log.warn("No mobile number found for item: {}", item);
                return null;
            }

            // Create WhatsApp request
            Map<String, Object> request = new HashMap<>();
            request.put("template", template);
            request.put("userDetails", Collections.singletonList(item));
            request.put("mobileNumber", mobileNumber);
            request.put("messageType", "WHATSAPP");

            // Add any additional configuration
            if (forEachConfig.getMessageConfig() != null) {
                request.put("config", forEachConfig.getMessageConfig());
            }

            return request;

        } catch (Exception e) {
            log.error("Error creating WhatsApp request", e);
            return null;
        }
    }

    private String extractMobileNumber(Map<String, Object> item) {
        // Try different possible field names for mobile number
        String[] possibleFields = { "mobileNumber", "mobile_number", "mobile", "phone", "phoneNumber", "phone_number" };

        for (String field : possibleFields) {
            Object value = item.get(field);
            if (value != null && !String.valueOf(value).isBlank()) {
                return String.valueOf(value);
            }
        }

        return null;
    }

    @Override
    public String getOperationType() {
        return "SEND_WHATSAPP";
    }
}