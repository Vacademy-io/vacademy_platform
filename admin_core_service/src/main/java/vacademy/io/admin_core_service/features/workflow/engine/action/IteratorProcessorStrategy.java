package vacademy.io.admin_core_service.features.workflow.engine.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IteratorConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategy;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class IteratorProcessorStrategy implements DataProcessorStrategy {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean canHandle(String operation) {
        return "ITERATOR".equalsIgnoreCase(operation);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext) {
        Map<String, Object> changes = new HashMap<>();

        try {
            IteratorConfigDTO iteratorConfig = objectMapper.convertValue(config, IteratorConfigDTO.class);

            // Evaluate the collection expression
            String onExpr = iteratorConfig.getOn();
            Object listObj = spelEvaluator.eval(onExpr, context);
            if (!(listObj instanceof Collection<?> list) || list.isEmpty()) {
                log.debug("Iterator found nothing for expression: {}", onExpr);
                return changes;
            }

            List<Map<String, Object>> processedItems = new ArrayList<>();

            // Process each item in the collection
            for (Object item : list) {
                Map<String, Object> loopContext = new HashMap<>(context);
                loopContext.put("item", item);

                // Process the forEach operation for this item
                Map<String, Object> itemResult = processForEachOperation(iteratorConfig.getForEach(), loopContext,
                        item);
                processedItems.add(itemResult);

                log.debug("Processed item in iterator: {} with result: {}", item, itemResult);
            }

            // Store results in changes
            changes.put("processed_items", processedItems);
            changes.put("item_count", list.size());
            changes.put("iterator_completed", true);

        } catch (Exception e) {
            log.error("Error executing Iterator processor", e);
            changes.put("iterator_error", e.getMessage());
        }

        return changes;
    }

    private Map<String, Object> processForEachOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        Map<String, Object> result = new HashMap<>();

        if (forEachConfig == null) {
            log.warn("No forEach configuration found in iterator");
            return result;
        }

        String operation = forEachConfig.getOperation();
        if (operation == null || operation.isBlank()) {
            log.warn("No operation specified in forEach configuration");
            return result;
        }

        try {
            switch (operation.toUpperCase()) {
                case "QUERY":
                    result = processQueryOperation(forEachConfig, loopContext, item);
                    break;
                case "UPDATE":
                    result = processUpdateOperation(forEachConfig, loopContext, item);
                    break;
                case "SEND_WHATSAPP":
                    result = processSendWhatsAppOperation(forEachConfig, loopContext, item);
                    break;
                case "SWITCH":
                    result = processSwitchOperation(forEachConfig, loopContext, item);
                    break;
                default:
                    log.warn("Unknown operation type in iterator: {}", operation);
                    result.put("operation", operation);
                    result.put("status", "unknown_operation");
            }
        } catch (Exception e) {
            log.error("Error processing forEach operation: {}", operation, e);
            result.put("operation", operation);
            result.put("status", "error");
            result.put("error", e.getMessage());
        }

        return result;
    }

    private Map<String, Object> processQueryOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        Map<String, Object> result = new HashMap<>();

        String prebuiltKey = forEachConfig.getPrebuiltKey();
        Map<String, Object> params = forEachConfig.getParams();

        if (prebuiltKey == null || prebuiltKey.isBlank()) {
            log.warn("QUERY operation missing prebuiltKey");
            result.put("status", "missing_prebuilt_key");
            return result;
        }

        // Process parameters - evaluate SPEL expressions
        Map<String, Object> processedParams = new HashMap<>();
        if (params != null) {
            for (Map.Entry<String, Object> entry : params.entrySet()) {
                String key = entry.getKey();
                Object value = entry.getValue();

                Object processedValue;
                if (value instanceof String && ((String) value).startsWith("#")) {
                    processedValue = spelEvaluator.eval((String) value, loopContext);
                } else {
                    processedValue = value;
                }
                processedParams.put(key, processedValue);
            }
        }

        log.info("Executing QUERY operation: {} with params: {} for item: {}", prebuiltKey, processedParams, item);

        // Store the query operation details for the main workflow engine to execute
        result.put("operation_type", "QUERY");
        result.put("prebuilt_key", prebuiltKey);
        result.put("params", processedParams);
        result.put("status", "queued_for_execution");

        return result;
    }

    private Map<String, Object> processUpdateOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        Map<String, Object> result = new HashMap<>();

        String updateField = forEachConfig.getUpdateField();
        Object updateValue = forEachConfig.getUpdateValue();

        if (updateField == null || updateField.isBlank()) {
            log.warn("UPDATE operation missing updateField");
            result.put("status", "missing_update_field");
            return result;
        }

        // Process update value - evaluate SPEL expressions
        Object processedValue;
        if (updateValue instanceof String && ((String) updateValue).startsWith("#")) {
            processedValue = spelEvaluator.eval((String) updateValue, loopContext);
        } else {
            processedValue = updateValue;
        }

        log.info("Executing UPDATE operation: {} = {} for item: {}", updateField, processedValue, item);

        result.put("operation_type", "UPDATE");
        result.put("update_field", updateField);
        result.put("update_value", processedValue);
        result.put("status", "queued_for_execution");

        return result;
    }

    private Map<String, Object> processSendWhatsAppOperation(ForEachConfigDTO forEachConfig,
            Map<String, Object> loopContext, Object item) {
        Map<String, Object> result = new HashMap<>();

        try {
            // Get the 'on' expression to evaluate templates
            String onExpr = forEachConfig.getOn();
            if (onExpr == null || onExpr.isBlank()) {
                log.warn("SEND_WHATSAPP operation missing 'on' expression");
                result.put("status", "missing_on_expression");
                return result;
            }

            // Evaluate the templates expression
            Object templatesObj = spelEvaluator.eval(onExpr, loopContext);
            if (templatesObj == null) {
                log.warn("No templates found for expression: {}", onExpr);
                result.put("status", "no_templates_found");
                return result;
            }

            // Process templates and create WhatsApp requests
            List<Map<String, Object>> whatsappRequests = processTemplatesAndCreateRequests(
                    templatesObj, loopContext, forEachConfig);

            if (!whatsappRequests.isEmpty()) {
                result.put("whatsapp_requests", whatsappRequests);
                result.put("request_count", whatsappRequests.size());
                result.put("status", "requests_created");

                log.info("Created {} WhatsApp requests for item: {}", whatsappRequests.size(), item);
            } else {
                result.put("status", "no_requests_created");
            }

        } catch (Exception e) {
            log.error("Error processing SEND_WHATSAPP operation", e);
            result.put("status", "error");
            result.put("error", e.getMessage());
        }

        return result;
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
                    WhatsappRequest request = createWhatsAppRequest(template, itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(convertWhatsappRequestToMap(request)); // Convert WhatsappRequest to Map
                    }
                }
            } else if (templatesObj instanceof Map) {
                // Handle map of templates
                Map<?, ?> templates = (Map<?, ?>) templatesObj;
                for (Map.Entry<?, ?> entry : templates.entrySet()) {
                    WhatsappRequest request = createWhatsAppRequest(entry.getValue(), itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(convertWhatsappRequestToMap(request)); // Convert WhatsappRequest to Map
                    }
                }
            } else {
                // Handle single template
                WhatsappRequest request = createWhatsAppRequest(templatesObj, itemContext, forEachConfig);
                if (request != null) {
                    requests.add(convertWhatsappRequestToMap(request)); // Convert WhatsappRequest to Map
                }
            }
        } catch (Exception e) {
            log.error("Error processing templates", e);
        }

        return requests;
    }

    private WhatsappRequest createWhatsAppRequest(Object template, Map<String, Object> itemContext,
            ForEachConfigDTO forEachConfig) {
        try {
            // Extract user details from context
            Object userDetailsObj = itemContext.get("item");
            if (userDetailsObj == null) {
                log.warn("No user details found in context");
                return null;
            }

            Map<String, Object> userDetails = JsonUtil.convertValue(userDetailsObj, Map.class);
            if (userDetails == null) {
                log.warn("Could not convert user details to map");
                return null;
            }

            // Extract mobile number
            String mobileNumber = extractMobileNumber(userDetails);
            if (mobileNumber == null || mobileNumber.isBlank()) {
                log.warn("No mobile number found for user: {}", userDetails);
                return null;
            }

            // Create WhatsApp request using existing WhatsappRequest class
            WhatsappRequest request = new WhatsappRequest();

            // Handle new template structure with templateName and placeholders
            if (template instanceof Map) {
                Map<String, Object> templateMap = (Map<String, Object>) template;
                String templateName = (String) templateMap.get("templateName");
                Map<String, Object> placeholders = (Map<String, Object>) templateMap.get("placeholders");

                if (templateName == null) {
                    log.warn("No templateName found in template: {}", template);
                    return null;
                }

                request.setTemplateName(templateName);

                // Create userDetails structure with placeholders
                Map<String, Map<String, String>> userDetail = new HashMap<>();
                Map<String, String> userInfo = new HashMap<>();

                // Add placeholders if they exist
                if (placeholders != null) {
                    for (Map.Entry<String, Object> entry : placeholders.entrySet()) {
                        if (entry.getValue() != null) {
                            userInfo.put(entry.getKey(), String.valueOf(entry.getValue()));
                        }
                    }
                }

                // Add other relevant user information from context
                for (Map.Entry<String, Object> entry : userDetails.entrySet()) {
                    if (entry.getValue() != null) {
                        userInfo.put(entry.getKey(), String.valueOf(entry.getValue()));
                    }
                }

                userDetail.put(mobileNumber, userInfo);
                request.setUserDetails(Collections.singletonList(userDetail));

            } else {
                // Fallback to old structure for backward compatibility
                log.warn("Template is not a Map, falling back to old structure: {}", template);
                return null;
            }

            // Set default language code if not specified
            request.setLanguageCode("en");

            return request;

        } catch (Exception e) {
            log.error("Error creating WhatsApp request", e);
            return null;
        }
    }

    /**
     * Convert WhatsappRequest to Map format for storage
     */
    private Map<String, Object> convertWhatsappRequestToMap(WhatsappRequest request) {
        Map<String, Object> map = new HashMap<>();
        map.put("templateName", request.getTemplateName());
        map.put("userDetails", request.getUserDetails());
        map.put("languageCode", request.getLanguageCode());
        map.put("headerParams", request.getHeaderParams());
        map.put("headerType", request.getHeaderType());
        return map;
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

    private Map<String, Object> processSwitchOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        Map<String, Object> result = new HashMap<>();

        String onExpr = forEachConfig.getOn();
        Map<String, Object> cases = forEachConfig.getCases();

        if (onExpr == null || onExpr.isBlank()) {
            log.warn("SWITCH operation missing 'on' expression");
            result.put("status", "missing_on_expression");
            return result;
        }

        // Evaluate the switch expression
        Object switchValue = spelEvaluator.eval(onExpr, loopContext);
        String key = String.valueOf(switchValue);

        // Find matching case
        Object selectedCase = cases != null ? cases.get(key) : null;
        if (selectedCase == null) {
            selectedCase = cases.get("default");
            log.debug("No case found for key: {}, using default", key);
        }

        if (selectedCase != null) {
            ((Map) item).put(forEachConfig.getEval(), selectedCase);
            result.put(forEachConfig.getEval(), selectedCase);
        }

        return result;
    }

    @Override
    public String getOperationType() {
        return "ITERATOR";
    }
}