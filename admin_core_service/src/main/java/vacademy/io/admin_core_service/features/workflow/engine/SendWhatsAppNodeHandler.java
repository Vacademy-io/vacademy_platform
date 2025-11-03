package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.SendWhatsAppNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendWhatsAppNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;
    private final TemplateRepository templateRepository;

    // A simple cache to avoid hitting the DB for the same template repeatedly
    // For a production system, consider a proper cache (e.g., Caffeine, Redis)
    private final Map<String, Template> templateCache = new HashMap<>();

    @Override
    public boolean supports(String nodeType) {
        // This string must match the "operation" in the automation node's config
        return "SEND_WHATSAPP".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                      String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates,
                                      int countProcessed) {

        log.info("SendWhatsAppNodeHandler.handle() invoked.");
        Map<String, Object> changes = new HashMap<>();

        try {
            // 1. Deserialize node configuration
            SendWhatsAppNodeDTO nodeDTO = objectMapper.readValue(nodeConfigJson, SendWhatsAppNodeDTO.class);
            String onExpression = nodeDTO.getOn();
            if (!StringUtils.hasText(onExpression)) {
                log.warn("SendWhatsAppNode missing 'on' expression");
                changes.put("status", "error");
                changes.put("error", "Missing 'on' expression");
                return changes;
            }

            // 2. Evaluate the 'on' expression to get the list of items (learners)
            Object listObj = spelEvaluator.evaluate(onExpression, context);
            if (listObj == null) {
                log.warn("No list found for expression: {}", onExpression);
                changes.put("status", "no_items_found");
                return changes;
            }

            List<Object> items;
            if (listObj instanceof List) {
                items = (List<Object>) listObj;
            } else if (listObj instanceof Collection) {
                items = new ArrayList<>((Collection<?>) listObj);
            } else {
                log.warn("Expression '{}' did not evaluate to a list: {}", onExpression, listObj.getClass());
                changes.put("status", "error");
                changes.put("error", "Expression did not evaluate to a list");
                return changes;
            }

            log.info("Processing {} items for WhatsApp sending", items.size());
            List<String> results = new ArrayList<>();
            String instituteId = (String) context.get("instituteId"); // Get instituteId from context

            if (!StringUtils.hasText(instituteId)) {
                log.warn("Missing 'instituteIdForWhatsapp' in context");
                changes.put("status", "error");
                changes.put("error", "Missing 'instituteIdForWhatsapp' in context");
                return changes;
            }

            // 3. Process each item (learner)
            for (Object item : items) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                // 4. Process the forEach operation to get the list of messages for this item
                List<Map<String, Object>> messagesToSend = processForEachOperation(
                    nodeDTO.getForEach(), itemContext);

                for (Map<String, Object> messageData : messagesToSend) {
                    try {
                        // 5. Build and send the individual WhatsApp request
                        WhatsappRequest request = buildValidatedRequest(messageData, instituteId);

                        // 6. Dispatch to the notification service
                        notificationService.sendWhatsappToUsers(request, instituteId);
                        results.add("SUCCESS: Sent " + request.getTemplateName() + " to " + request.getUserDetails().get(0).keySet());

                    } catch (Exception e) {
                        log.error("Failed to send WhatsApp message: {}", e.getMessage(), e);
                        results.add("ERROR: " + e.getMessage());
                    }
                }
            }

            changes.put("status", "completed");
            changes.put("results", results);
            changes.put("processed_count", items.size());

        } catch (Exception e) {
            log.error("Error handling SendWhatsApp node", e);
            changes.put("status", "error");
            changes.put("error", e.getMessage());
        }

        return changes;
    }

    /**
     * Evaluates the 'eval' expression to get the list of messages for a single item.
     */
    private List<Map<String, Object>> processForEachOperation(ForEachConfigDTO forEachConfig,
                                                              Map<String, Object> itemContext) {
        if (forEachConfig == null) {
            log.warn("No forEach configuration found in SendWhatsApp node");
            return List.of();
        }

        String evalExpression = forEachConfig.getEval();
        if (!StringUtils.hasText(evalExpression)) {
            log.warn("SEND_WHATSAPP forEach missing 'eval' expression");
            return List.of();
        }

        try {
            // Evaluate the expression (e.g., "#ctx['item']['whatsappData']")
            Object evalResult = spelEvaluator.evaluate(evalExpression, itemContext);

            if (evalResult instanceof List) {
                return (List<Map<String, Object>>) evalResult;
            } else if (evalResult != null) {
                log.warn("Eval expression did not return a List. Got: {}", evalResult.getClass().getName());
            }

        } catch (Exception e) {
            log.error("Error processing forEach operation for item: {}", itemContext.get("item"), e);
        }

        return List.of();
    }

    /**
     * Performs template validation and builds the final WhatsappRequest DTO.
     */
    private WhatsappRequest buildValidatedRequest(Map<String, Object> messageData, String instituteId) {
        String templateName = (String) messageData.get("templateName");
        String languageCode = (String) messageData.get("languageCode");
        String mobileNumber = (String) messageData.get("mobileNumber");
        String userId = (String) messageData.get("userId");
        Map<String, String> templateVarsFromAutomation = (Map<String, String>) messageData.get("templateVars");

        // 1. Fetch Template (with caching)
        String cacheKey = instituteId + ":" + templateName;
        Template template = templateCache.computeIfAbsent(cacheKey, k ->
            templateRepository.findByInstituteIdAndNameAndType(instituteId, templateName, "WHATSAPP")
                .orElseThrow(() -> new VacademyException("Template not found with name: " + templateName + " for institute: " + instituteId))
        );

        // 2. Parse template's required parameters
        Map<String, String> dynamicParams = parseDynamicParameters(template.getDynamicParameters());
        Map<String, String> finalParamMap = new HashMap<>();

        // 3. Validate and build final parameters
        if (dynamicParams != null && !dynamicParams.isEmpty()) {
            for (String requiredKey : dynamicParams.keySet()) {
                if (!templateVarsFromAutomation.containsKey(requiredKey)) {
                    // ERROR: As requested, throw exception if a var is missing
                    throw new RuntimeException("Missing required template variable '" + requiredKey +
                        "' for template: " + templateName + ", user: " + userId);
                }
                String value = templateVarsFromAutomation.get(requiredKey);
                finalParamMap.put(requiredKey, value != null ? value : ""); // Use value from automation
            }
        } else {
            // No dynamic params defined, just log a warning or proceed if this is allowed
            log.warn("No dynamic_parameters JSON found for template: {}. Proceeding without validation.", templateName);
            // If you still want to send, uncomment the line below
            // finalParamMap.putAll(templateVarsFromAutomation);
        }

        // 4. Sanitize Mobile Number
        String sanitizedMobile = mobileNumber;
        if (sanitizedMobile != null && StringUtils.hasText(sanitizedMobile)) {
            sanitizedMobile = sanitizedMobile.replaceAll("[^0-9]", "");
        } else {
            throw new VacademyException("Missing mobileNumber for user: " + userId);
        }

        // 5. Build final WhatsappRequest DTO
        WhatsappRequest request = new WhatsappRequest();
        request.setTemplateName(templateName);
        request.setLanguageCode(StringUtils.hasText(languageCode) ? languageCode : "en");
        request.setHeaderParams(null); // As requested

        Map<String, Map<String, String>> singleUserForDto = new HashMap<>();
        singleUserForDto.put(sanitizedMobile, finalParamMap);
        request.setUserDetails(List.of(singleUserForDto));

        return request;
    }

    /**
     * Helper to parse the dynamic_parameters JSON string from the Template entity.
     */
    private Map<String, String> parseDynamicParameters(String dynamicParametersJson) {
        if (!StringUtils.hasText(dynamicParametersJson)) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(dynamicParametersJson, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to parse dynamic_parameters JSON: " + dynamicParametersJson, e);
            return new HashMap<>(); // Return empty to avoid null pointers
        }
    }
}
