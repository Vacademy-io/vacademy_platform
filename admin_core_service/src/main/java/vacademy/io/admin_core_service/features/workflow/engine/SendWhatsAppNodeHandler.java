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

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendWhatsAppNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;
    private final TemplateRepository templateRepository;

    // Cache for templates (InstituteID:TemplateName -> Template)
    private final Map<String, Template> templateCache = new HashMap<>();

    @Override
    public boolean supports(String nodeType) {
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
            SendWhatsAppNodeDTO nodeDTO = objectMapper.readValue(nodeConfigJson, SendWhatsAppNodeDTO.class);
            String onExpression = nodeDTO.getOn();
            if (!StringUtils.hasText(onExpression)) {
                log.warn("SendWhatsAppNode missing 'on' expression");
                changes.put("status", "error");
                changes.put("error", "Missing 'on' expression");
                return changes;
            }

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
            String instituteId = (String) context.get("instituteIdForWhatsapp"); // Use correct context key

            if (!StringUtils.hasText(instituteId)) {
                log.warn("Missing 'instituteIdForWhatsapp' in context");
                changes.put("status", "error");
                changes.put("error", "Missing 'instituteIdForWhatsapp' in context");
                return changes;
            }

            // --- OPTIMIZATION START ---

            // Map to group users by templateName
            Map<String, WhatsappRequest> batchRequestMap = new HashMap<>();
            // Set to deduplicate (mobileNumber::templateName)
            Set<String> sentLog = new HashSet<>();
            int processedCount = 0;
            int skippedCount = 0;

            for (Object item : items) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                List<Map<String, Object>> messagesToSend = processForEachOperation(
                    nodeDTO.getForEach(), itemContext);

                for (Map<String, Object> messageData : messagesToSend) {
                    try {
                        String templateName = (String) messageData.get("templateName");
                        String languageCode = (String) messageData.get("languageCode");
                        String mobileNumber = (String) messageData.get("mobileNumber");
                        String userId = (String) messageData.get("userId");
                        Map<String, String> templateVars = (Map<String, String>) messageData.get("templateVars");

                        // 1. Validate Mobile Number
                        if (!StringUtils.hasText(mobileNumber)) {
                            log.warn("Skipping user {}: mobile number is null or empty.", userId);
                            results.add("SKIPPED: User " + userId + " - Missing mobile number.");
                            skippedCount++;
                            continue;
                        }

                        // Sanitize: remove '+' and all non-numeric characters
                        String sanitizedMobile = mobileNumber.replaceAll("[^0-9]", "");

                        if (!StringUtils.hasText(sanitizedMobile)) {
                            log.warn("Skipping user {}: mobile number '{}' is invalid after sanitization.", userId, mobileNumber);
                            results.add("SKIPPED: User " + userId + " - Invalid mobile number.");
                            skippedCount++;
                            continue;
                        }

                        // 2. Deduplicate
                        String dedupeKey = sanitizedMobile + "::" + templateName;
                        if (sentLog.contains(dedupeKey)) {
                            log.warn("Skipping user {}: duplicate request for template '{}'.", userId, templateName);
                            results.add("SKIPPED: User " + userId + " - Duplicate request.");
                            skippedCount++;
                            continue;
                        }

                        // 3. Fetch Template (from cache or DB)
                        String cacheKey = instituteId + ":" + templateName;
                        Template template = templateCache.computeIfAbsent(cacheKey, k ->
                            templateRepository.findByInstituteIdAndNameAndType(instituteId, templateName, "WHATSAPP")
                                .orElseThrow(() -> new VacademyException("Template not found with name: " + templateName + " for institute: " + instituteId))
                        );

                        // 4. Build User Params
                        Map<String, String> finalParamMap = buildValidatedParams(template, templateVars, userId);
                        Map<String, Map<String, String>> singleUser = Map.of(sanitizedMobile, finalParamMap);

                        // 5. Add to Batch
                        WhatsappRequest batchRequest = batchRequestMap.computeIfAbsent(templateName, k -> {
                            WhatsappRequest newReq = new WhatsappRequest();
                            newReq.setTemplateName(templateName);
                            newReq.setLanguageCode(StringUtils.hasText(languageCode) ? languageCode : "en");
                            newReq.setHeaderParams(null);
                            newReq.setUserDetails(new ArrayList<>()); // Initialize list
                            return newReq;
                        });

                        batchRequest.getUserDetails().add(singleUser);
                        sentLog.add(dedupeKey); // Mark as processed
                        processedCount++;

                    } catch (Exception e) {
                        log.error("Failed to build WhatsApp request for item {}: {}", item, e.getMessage());
                        results.add("ERROR: " + e.getMessage());
                    }
                }
            }

            // 6. Dispatch Batches
            List<WhatsappRequest> finalBatchList = new ArrayList<>(batchRequestMap.values());
            if (!finalBatchList.isEmpty()) {
                try {
                    // Call the batch method ONCE
                    notificationService.sendWhatsappToUsers(finalBatchList, instituteId);
                    log.info("Successfully dispatched {} WhatsApp batches for {} total users.", finalBatchList.size(), processedCount);
                    results.add("SUCCESS: Dispatched " + finalBatchList.size() + " batches for " + processedCount + " users.");
                } catch (Exception e) {
                    log.error("Failed to send WhatsApp batch request: {}", e.getMessage(), e);
                    results.add("ERROR: Batch send failed - " + e.getMessage());
                }
            }
            // --- OPTIMIZATION END ---

            changes.put("status", "completed");
            changes.put("results", results);
            changes.put("processed_count", processedCount);
            changes.put("skipped_count", skippedCount);

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
     * Validates template variables against the template's dynamic parameters.
     * This logic is extracted from the old buildValidatedRequest.
     */
    private Map<String, String> buildValidatedParams(Template template, Map<String, String> templateVarsFromAutomation, String userId) {
        // Parse template's required parameters
        Map<String, String> dynamicParams = parseDynamicParameters(template.getDynamicParameters());
        Map<String, String> finalParamMap = new HashMap<>();

        // Validate and build final parameters
        if (dynamicParams != null && !dynamicParams.isEmpty()) {
            for (String requiredKey : dynamicParams.keySet()) {
                if (!templateVarsFromAutomation.containsKey(requiredKey)) {
                    throw new RuntimeException("Missing required template variable '" + requiredKey +
                        "' for template: " + template.getName() + ", user: " + userId);
                }
                String value = templateVarsFromAutomation.get(requiredKey);
                finalParamMap.put(requiredKey, value != null ? value : "");
            }
        } else {
            log.warn("No dynamic_parameters JSON found for template: {}. Proceeding without validation.", template.getName());
            finalParamMap.putAll(templateVarsFromAutomation); // Send all vars if no dynamic params defined
        }
        return finalParamMap;
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
            return new HashMap<>();
        }
    }
}
