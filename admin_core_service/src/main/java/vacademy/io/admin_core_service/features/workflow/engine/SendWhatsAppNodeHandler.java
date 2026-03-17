package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.SendWhatsAppNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowExecutionLogger;

import vacademy.io.admin_core_service.features.workflow.enums.ExecutionLogStatus;
import vacademy.io.admin_core_service.features.workflow.enums.NodeType;
import vacademy.io.admin_core_service.features.workflow.dto.execution_log.WhatsAppExecutionDetails;
import vacademy.io.common.logging.SentryLogger;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendWhatsAppNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;
    private final TemplateRepository templateRepository;
    private final WorkflowExecutionLogger executionLogger;

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

        String workflowExecutionId = (String) context.get("executionId");
        String nodeId = (String) context.get("currentNodeId");

        // Start logging
        String logId = null;
        long startTime = System.currentTimeMillis();
        if (workflowExecutionId != null && nodeId != null) {
            logId = executionLogger.startNodeExecution(workflowExecutionId, nodeId, NodeType.SEND_WHATSAPP,
                    context);
        }

        Map<String, Object> changes = new HashMap<>();
        int processedCount = 0;
        int skippedCount = 0;
        int failedCount = 0;
        List<String> results = new ArrayList<>();
        List<WhatsAppExecutionDetails.FailedMessage> failedMessages = new ArrayList<>();

        try {
            SendWhatsAppNodeDTO nodeDTO = objectMapper.readValue(nodeConfigJson, SendWhatsAppNodeDTO.class);
            String onExpression = nodeDTO.getOn();
            if (!StringUtils.hasText(onExpression)) {
                log.warn("SendWhatsAppNode missing 'on' expression");
                changes.put("status", "error");
                changes.put("error", "Missing 'on' expression");

                if (logId != null) {
                    executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                            "Missing 'on' expression");
                }
                return changes;
            }

            Object listObj = spelEvaluator.evaluate(onExpression, context);
            if (listObj == null) {
                log.warn("No list found for expression: {}", onExpression);
                changes.put("status", "no_items_found");

                if (logId != null) {
                    WhatsAppExecutionDetails details = WhatsAppExecutionDetails.builder()
                            .inputContext(executionLogger.sanitizeContext(context))
                            .outputContext(executionLogger.sanitizeContext(changes))
                            .successCount(0)
                            .failureCount(0)
                            .skippedCount(0)
                            .executionTimeMs(System.currentTimeMillis() - startTime)
                            .build();
                    executionLogger.completeNodeExecution(logId, ExecutionLogStatus.SUCCESS, details,
                            null);
                }
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

                if (logId != null) {
                    executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                            "Expression did not evaluate to a list");
                }
                return changes;
            }

            log.info("Processing {} items for WhatsApp sending", items.size());
            
            // BACKWARD COMPATIBLE: Check both context keys for institute ID
            String instituteIdTemp = (String) context.get("instituteIdForWhatsapp"); // SEND_WHATSAPP format
            if (!StringUtils.hasText(instituteIdTemp)) {
                instituteIdTemp = (String) context.get("instituteId"); // COMBOT fallback
            }
            final String instituteId = instituteIdTemp; // Make effectively final for lambda usage

            if (!StringUtils.hasText(instituteId)) {
                log.warn("Missing 'instituteIdForWhatsapp' or 'instituteId' in context");
                changes.put("status", "error");
                changes.put("error", "Missing institute ID in context");

                if (logId != null) {
                    executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                            "Missing institute ID in context");
                }
                return changes;
            }

            // --- OPTIMIZATION START ---

            // Map to group users by templateName
            Map<String, WhatsappRequest> batchRequestMap = new HashMap<>();
            // Map to store original items for failure tracking
            Map<String, Object> mobileToItemMap = new HashMap<>();
            // Set to deduplicate (mobileNumber::templateName)
            Set<String> sentLog = new HashSet<>();
            
            // NEW: Maps for COMBOT-specific features (per-phone)
            Map<String, Map<String, String>> headerVideoParamsMap = new HashMap<>();  // templateName -> (phone -> videoUrl)
            Map<String, Map<String, String>> buttonUrlParamsMap = new HashMap<>();    // templateName -> (phone -> buttonParam)
            Map<String, Map<String, String>> buttonIndexParamsMap = new HashMap<>();  // templateName -> (phone -> buttonIndex)

            int index = 0;
            for (Object item : items) {
                index++;
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                List<Map<String, Object>> messagesToSend = processForEachOperation(
                        nodeDTO.getForEach(), itemContext);

                for (Map<String, Object> messageData : messagesToSend) {
                    // BACKWARD COMPATIBLE: Accept both "mobileNumber" and "to" (COMBOT format)
                    String mobileNumber = (String) messageData.get("mobileNumber");
                    if (mobileNumber == null) {
                        mobileNumber = (String) messageData.get("to"); // COMBOT compatibility
                    }
                    
                    String templateName = (String) messageData.get("templateName");
                    String languageCode = (String) messageData.get("languageCode");
                    String userId = (String) messageData.get("userId");
                    
                    // BACKWARD COMPATIBLE: Accept both "templateVars" (Map) and "params" (List - COMBOT format)
                    Map<String, String> templateVars = (Map<String, String>) messageData.get("templateVars");
                    if (templateVars == null) {
                        // COMBOT format: params is a List<String> - convert to Map
                        Object paramsObj = messageData.get("params");
                        if (paramsObj instanceof List) {
                            List<String> paramsList = (List<String>) paramsObj;
                            templateVars = new HashMap<>();
                            for (int i = 0; i < paramsList.size(); i++) {
                                templateVars.put(String.valueOf(i + 1), paramsList.get(i));
                            }
                        }
                    }
                    
                    // NEW: Extract COMBOT-specific fields
                    String headerImage = (String) messageData.get("headerImage");
                    String headerVideo = (String) messageData.get("headerVideo");
                    String buttonUrlParam = (String) messageData.get("buttonUrlParam");
                    String buttonIndex = (String) messageData.getOrDefault("buttonIndex", "0");

                    try {
                        // 1. Validate Mobile Number
                        if (!StringUtils.hasText(mobileNumber)) {
                            log.warn("Skipping user {}: mobile number is null or empty.", userId);
                            results.add("SKIPPED: User " + userId + " - Missing mobile number.");
                            skippedCount++;
                            failedMessages.add(WhatsAppExecutionDetails.FailedMessage.builder()
                                    .index(index)
                                    .mobileNumber(mobileNumber)
                                    .templateName(templateName)
                                    .languageCode(languageCode)
                                    .templateVars(new HashMap<>(templateVars != null ? templateVars : Map.of()))
                                    .itemData(item)
                                    .errorMessage("Missing mobile number")
                                    .errorType("VALIDATION_ERROR")
                                    .failureReason("SKIPPED")
                                    .build());
                            continue;
                        }

                        // Sanitize: remove '+' and all non-numeric characters
                        String sanitizedMobile = mobileNumber.replaceAll("[^0-9]", "");

                        if (!StringUtils.hasText(sanitizedMobile)) {
                            log.warn("Skipping user {}: mobile number '{}' is invalid after sanitization.", userId,
                                    mobileNumber);
                            results.add("SKIPPED: User " + userId + " - Invalid mobile number.");
                            skippedCount++;
                            failedMessages.add(WhatsAppExecutionDetails.FailedMessage.builder()
                                    .index(index)
                                    .mobileNumber(mobileNumber)
                                    .templateName(templateName)
                                    .languageCode(languageCode)
                                    .templateVars(new HashMap<>(templateVars != null ? templateVars : Map.of()))
                                    .itemData(item)
                                    .errorMessage("Invalid mobile number")
                                    .errorType("VALIDATION_ERROR")
                                    .failureReason("SKIPPED")
                                    .build());
                            continue;
                        }

                        // 2. Deduplicate
                        String dedupeKey = sanitizedMobile + "::" + templateName;
                        if (sentLog.contains(dedupeKey)) {
                            log.warn("Skipping user {}: duplicate request for template '{}'.", userId, templateName);
                            results.add("SKIPPED: User " + userId + " - Duplicate request.");
                            skippedCount++;
                            failedMessages.add(WhatsAppExecutionDetails.FailedMessage.builder()
                                    .index(index)
                                    .mobileNumber(mobileNumber)
                                    .templateName(templateName)
                                    .languageCode(languageCode)
                                    .templateVars(new HashMap<>(templateVars != null ? templateVars : Map.of()))
                                    .itemData(item)
                                    .errorMessage("Duplicate request")
                                    .errorType("DUPLICATE")
                                    .failureReason("SKIPPED")
                                    .build());
                            continue;
                        }

                        // DETECT COMBOT FORMAT: If params was originally a List (converted to Map above),
                        // skip DB template lookup - COMBOT workflows define template directly in config
                        boolean isCombotFormat = messageData.get("params") instanceof List;
                        
                        Map<String, String> finalParamMap;
                        if (isCombotFormat) {
                            // COMBOT format: Skip DB lookup, use params directly (already converted to Map)
                            log.debug("COMBOT format detected - skipping template DB lookup for: {}", templateName);
                            finalParamMap = templateVars != null ? templateVars : new HashMap<>();
                        } else {
                            // SEND_WHATSAPP format: Fetch Template from DB and validate params
                            String cacheKey = instituteId + ":" + templateName;
                            Template template = templateCache.computeIfAbsent(cacheKey,
                                    k -> templateRepository
                                            .findByInstituteIdAndNameAndType(instituteId, templateName, "WHATSAPP")
                                            .orElseThrow(() -> new VacademyException("Template not found with name: "
                                                    + templateName + " for institute: " + instituteId)));

                            // Build and validate params against template
                            finalParamMap = buildValidatedParams(template, templateVars, userId);
                        }
                        
                        Map<String, Map<String, String>> singleUser = Map.of(sanitizedMobile, finalParamMap);

                        // 5. Add to Batch
                        WhatsappRequest batchRequest = batchRequestMap.computeIfAbsent(templateName, k -> {
                            WhatsappRequest newReq = new WhatsappRequest();
                            newReq.setTemplateName(templateName);
                            newReq.setLanguageCode(StringUtils.hasText(languageCode) ? languageCode : "en");
                            newReq.setHeaderParams(new HashMap<>()); // Initialize for potential image headers
                            newReq.setUserDetails(new ArrayList<>()); // Initialize list
                            newReq.setHeaderVideoParams(new HashMap<>()); // NEW: Initialize video params
                            newReq.setButtonUrlParams(new HashMap<>());   // NEW: Initialize button params
                            newReq.setButtonIndexParams(new HashMap<>()); // NEW: Initialize button index params
                            return newReq;
                        });

                        batchRequest.getUserDetails().add(singleUser);
                        
                        // NEW: Handle COMBOT-specific features
                        // Header Image (existing format: headerParams)
                        if (StringUtils.hasText(headerImage)) {
                            if (batchRequest.getHeaderParams() == null) {
                                batchRequest.setHeaderParams(new HashMap<>());
                            }
                            batchRequest.getHeaderParams().put(sanitizedMobile, Map.of("1", headerImage));
                            batchRequest.setHeaderType("image");
                        }
                        
                        // Header Video (NEW for COMBOT)
                        if (StringUtils.hasText(headerVideo)) {
                            batchRequest.getHeaderVideoParams().put(sanitizedMobile, headerVideo);
                            batchRequest.setHeaderType("video");
                        }
                        
                        // Button URL Param (NEW for COMBOT)
                        if (StringUtils.hasText(buttonUrlParam)) {
                            batchRequest.getButtonUrlParams().put(sanitizedMobile, buttonUrlParam);
                            batchRequest.getButtonIndexParams().put(sanitizedMobile, 
                                StringUtils.hasText(buttonIndex) ? buttonIndex : "0");
                        }
                        
                        sentLog.add(dedupeKey); // Mark as processed
                        processedCount++;

                        // Store item for failure tracking
                        mobileToItemMap.put(sanitizedMobile, item);

                    } catch (Exception e) {
                        log.error("Failed to build WhatsApp request for item {}: {}", item, e.getMessage());
                        SentryLogger.SentryEventBuilder.error(e)
                                .withMessage("Failed to build WhatsApp request for user")
                                .withTag("workflow.execution.id",
                                        workflowExecutionId != null ? workflowExecutionId : "unknown")
                                .withTag("node.id", nodeId != null ? nodeId : "unknown")
                                .withTag("node.type", "SEND_WHATSAPP")
                                .withTag("template.name", templateName != null ? templateName : "unknown")
                                .withTag("institute.id", instituteId)
                                .withTag("operation", "buildWhatsAppRequest")
                                .send();
                        results.add("ERROR: " + e.getMessage());
                        failedCount++; // Count build failures as failed
                        failedMessages.add(WhatsAppExecutionDetails.FailedMessage.builder()
                                .index(index)
                                .mobileNumber(mobileNumber)
                                .templateName(templateName)
                                .languageCode(languageCode)
                                .templateVars(new HashMap<>(templateVars != null ? templateVars : Map.of()))
                                .itemData(item)
                                .errorMessage(e.getMessage())
                                .errorType("PROCESSING_ERROR")
                                .failureReason("FAILED")
                                .build());
                    }
                }
            }

            // 6. Dispatch Batches
            List<WhatsappRequest> finalBatchList = new ArrayList<>(batchRequestMap.values());
            if (!finalBatchList.isEmpty()) {
                try {
                    // Call the batch method ONCE
                    notificationService.sendWhatsappToUsers(finalBatchList, instituteId);
                    log.info("Successfully dispatched {} WhatsApp batches for {} total users.", finalBatchList.size(),
                            processedCount);
                    results.add("SUCCESS: Dispatched " + finalBatchList.size() + " batches for " + processedCount
                            + " users.");
                } catch (Exception e) {
                    log.error("Failed to send WhatsApp batch request: {}", e.getMessage(), e);
                    SentryLogger.SentryEventBuilder.error(e)
                            .withMessage("WhatsApp batch send failed")
                            .withTag("workflow.execution.id",
                                    workflowExecutionId != null ? workflowExecutionId : "unknown")
                            .withTag("node.id", nodeId != null ? nodeId : "unknown")
                            .withTag("node.type", "SEND_WHATSAPP")
                            .withTag("batch.count", String.valueOf(finalBatchList.size()))
                            .withTag("user.count", String.valueOf(processedCount))
                            .withTag("institute.id", instituteId)
                            .withTag("operation", "sendWhatsAppBatch")
                            .send();
                    results.add("ERROR: Batch send failed - " + e.getMessage());

                    // Handle failures for all users in these batches
                    for (WhatsappRequest batch : finalBatchList) {
                        if (batch.getUserDetails() != null) {
                            for (Map<String, Map<String, String>> userMap : batch.getUserDetails()) {
                                // userMap key is the mobile number
                                for (String mobile : userMap.keySet()) {
                                    Object originalItem = mobileToItemMap.get(mobile);

                                    failedMessages.add(WhatsAppExecutionDetails.FailedMessage.builder()
                                            .mobileNumber(mobile)
                                            .templateName(batch.getTemplateName())
                                            .errorMessage("Batch send failed: " + e.getMessage())
                                            .errorType("BATCH_SEND_ERROR")
                                            .failureReason("FAILED")
                                            .itemData(originalItem)
                                            .build());

                                    failedCount++;
                                    processedCount--; // Decrement as it failed
                                }
                            }
                        }
                    }
                }
            }
            // --- OPTIMIZATION END ---

            changes.put("status", "completed");
            changes.put("results", results);
            changes.put("processed_count", processedCount);
            changes.put("skipped_count", skippedCount);

            // Complete logging with success
            if (logId != null) {
                ExecutionLogStatus status = ExecutionLogStatus.SUCCESS;
                if (failedCount > 0 || skippedCount > 0) {
                    status = ExecutionLogStatus.PARTIAL_SUCCESS;
                }
                if (processedCount == 0 && (failedCount > 0 || skippedCount > 0)) {
                    if (skippedCount == 0) {
                        status = ExecutionLogStatus.FAILED;
                    }
                }

                WhatsAppExecutionDetails details = WhatsAppExecutionDetails.builder()
                        // Minimize data: do not store full context
                        .inputContext(null)
                        .outputContext(null)
                        .successCount(processedCount)
                        .failureCount(failedCount)
                        .skippedCount(skippedCount)
                        .failedMessages(failedMessages)
                        .executionTimeMs(System.currentTimeMillis() - startTime)
                        .build();

                executionLogger.completeNodeExecution(logId, status, details, null);
            }

        } catch (Exception e) {
            log.error("Error handling SendWhatsApp node", e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("SendWhatsApp node execution failed")
                    .withTag("workflow.execution.id", workflowExecutionId != null ? workflowExecutionId : "unknown")
                    .withTag("node.id", nodeId != null ? nodeId : "unknown")
                    .withTag("node.type", "SEND_WHATSAPP")
                    .withTag("operation", "handleSendWhatsAppNode")
                    .send();
            changes.put("status", "error");
            changes.put("error", e.getMessage());

            // Log failure
            if (logId != null) {
                executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                        e.getMessage());
            }
        }

        return changes;
    }

    /**
     * Evaluates the 'eval' expression to get the list of messages for a single
     * item.
     * BACKWARD COMPATIBLE: Accepts both List<Map> and single Map (COMBOT format)
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
            } else if (evalResult instanceof Map) {
                // COMBOT compatibility: single Map result
                return List.of((Map<String, Object>) evalResult);
            } else if (evalResult != null) {
                log.warn("Eval expression did not return a List or Map. Got: {}", evalResult.getClass().getName());
            }
        } catch (Exception e) {
            log.error("Error processing forEach operation for item: {}", itemContext.get("item"), e);
            SentryLogger.logError(e, "WhatsApp forEach operation failed", Map.of(
                    "operation", "processForEachOperation",
                    "node.type", "SEND_WHATSAPP"));
        }

        return List.of();
    }

    /**
     * Validates template variables against the template's dynamic parameters.
     * This logic is extracted from the old buildValidatedRequest.
     */
    private Map<String, String> buildValidatedParams(Template template, Map<String, String> templateVarsFromAutomation,
            String userId) {
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
            log.warn("No dynamic_parameters JSON found for template: {}. Proceeding without validation.",
                    template.getName());
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
            return objectMapper.readValue(dynamicParametersJson, new TypeReference<>() {
            });
        } catch (Exception e) {
            log.error("Failed to parse dynamic_parameters JSON: " + dynamicParametersJson, e);
            SentryLogger.logError(e, "Failed to parse WhatsApp template parameters", Map.of(
                    "operation", "parseDynamicParameters",
                    "node.type", "SEND_WHATSAPP"));
            return new HashMap<>();
        }
    }
}
