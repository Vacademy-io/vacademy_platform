package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.SendEmailNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
// --- Import Attachment DTOs for the ATTACHMENT_EMAIL operation ---
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendEmailNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;
    private final TemplateRepository templateRepository;
    private final Map<String, Template> templateCache = new HashMap<>();

    @Override
    public boolean supports(String nodeType) {
        return "SEND_EMAIL".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                      String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates,
                                      int countProcessed) {

        log.info("SendEmailNodeHandler.handle() invoked.");
        Map<String, Object> changes = new HashMap<>();

        String instituteId = (String) context.get("instituteId");
        if (!StringUtils.hasText(instituteId)) {
            instituteId = (String) context.get("instituteIdForWhatsapp");
            if (!StringUtils.hasText(instituteId)) {
                log.warn("SendEmailNode missing 'instituteId' from context");
                changes.put("status", "error");
                changes.put("error", "Missing 'instituteId' from context");
                return changes;
            }
        }
        final String finalInstituteId = instituteId; // For use in streams/lambdas

        try {
            SendEmailNodeDTO sendEmailNodeDTO = objectMapper.readValue(nodeConfigJson, SendEmailNodeDTO.class);
            String onExpression = sendEmailNodeDTO.getOn();
            if (onExpression == null || onExpression.isBlank()) {
                log.warn("SendEmailNode missing 'on' expression");
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

            List<Object> items = new ArrayList<>();
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

            log.info("Processing {} items for email sending", items.size());

            // 1. Create all individual email "requests" (raw data maps)
            List<Map<String, Object>> allEmailRequests = new ArrayList<>();
            for (Object item : items) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item); // 'item' is now the recipient email (for attachment) or user map (for regular)

                List<Map<String, Object>> itemRequests = processForEachOperation(sendEmailNodeDTO.getForEach(),
                    itemContext, item);
                if (itemRequests != null && !itemRequests.isEmpty()) {
                    allEmailRequests.addAll(itemRequests);
                }
            }

            // --- BATCHING AND DEDUPLICATION LOGIC ---
            if (!allEmailRequests.isEmpty()) {

                // Batch maps
                Map<String, NotificationDTO> regularBatchMap = new HashMap<>();
                Map<String, AttachmentNotificationDTO> attachmentBatchMap = new HashMap<>();

                // Deduplication set
                Set<String> sentLog = new HashSet<>();
                int processedCount = 0;
                int skippedCount = 0;
                List<String> emailResults = new ArrayList<>();

                for (Map<String, Object> request : allEmailRequests) {
                    String recipient = (String) request.get("recipient");
                    String subject = (String) request.get("subject");
                    String type = (String) request.getOrDefault("type", "REGULAR");

                    if (recipient == null || recipient.isBlank()) {
                        log.warn("Skipping email request, recipient is null or blank.");
                        skippedCount++;
                        continue;
                    }

                    // --- Deduplication Check ---
                    String dedupeKey = recipient + "::" + subject;
                    if (sentLog.contains(dedupeKey)) {
                        log.warn("Duplicate email request for {} with subject ''{}''. Skipping.", recipient, subject);
                        skippedCount++;
                        continue; // Already added this user for this template
                    }
                    sentLog.add(dedupeKey);
                    // --- End Deduplication ---

                    processedCount++;

                    // --- Batching by Type ---
                    if ("ATTACHMENT_EMAIL".equals(type)) {
                        String body = (String) request.get("body");
                        String attachmentName = (String) request.get("attachmentName");
                        String attachmentBase64 = (String) request.get("attachmentBase64");
                        Map<String, String> placeholders = (Map<String, String>) request.get("placeholders");

                        // Group by subject + body + attachmentName
                        String groupingKey = subject + "||" + body + "||" + attachmentName;

                        AttachmentNotificationDTO batchDTO = attachmentBatchMap.computeIfAbsent(groupingKey, k ->
                            AttachmentNotificationDTO.builder()
                                .subject(subject)
                                .body(body)
                                .notificationType("EMAIL")
                                .source("WORKFLOW")
                                .sourceId("send_attachment_email_batch")
                                .users(new ArrayList<>())
                                .build()
                        );

                        AttachmentUsersDTO userDTO = new AttachmentUsersDTO();
                        userDTO.setChannelId(recipient);
                        userDTO.setUserId(recipient);
                        userDTO.setPlaceholders(placeholders); // Add placeholders

                        AttachmentUsersDTO.AttachmentDTO attachment = new AttachmentUsersDTO.AttachmentDTO();
                        attachment.setAttachmentName(attachmentName);
                        attachment.setAttachment(attachmentBase64);
                        userDTO.setAttachments(List.of(attachment));

                        batchDTO.getUsers().add(userDTO);

                    } else { // "REGULAR" email
                        String body = (String) request.get("body");
                        Map<String, String> placeholders = (Map<String, String>) request.get("placeholders");
                        String groupingKey = subject + "||" + body;

                        NotificationDTO batchDTO = regularBatchMap.computeIfAbsent(groupingKey, k -> {
                            NotificationDTO newDto = new NotificationDTO();
                            newDto.setSubject(subject);
                            newDto.setBody(body);
                            newDto.setNotificationType("EMAIL");
                            newDto.setSource("WORKFLOW");
                            newDto.setSourceId("send_email_node_batch");
                            newDto.setUsers(new ArrayList<>());
                            return newDto;
                        });

                        NotificationToUserDTO userDTO = new NotificationToUserDTO();
                        userDTO.setChannelId(recipient);
                        userDTO.setUserId(recipient);
                        userDTO.setPlaceholders(placeholders != null ? placeholders : Map.of("email", recipient));

                        batchDTO.getUsers().add(userDTO);
                    }
                }

                // --- Send Regular Email Batches ---
                if (!regularBatchMap.isEmpty()) {
                    List<NotificationDTO> finalBatchList = new ArrayList<>(regularBatchMap.values());
                    try {
                        String result = notificationService.sendEmailToUsersMultiple(finalBatchList, finalInstituteId);
                        emailResults.add(result);
                        log.info("Successfully dispatched {} regular email batches.", finalBatchList.size());
                    } catch (Exception e) {
                        log.error("Error sending regular email batch request", e);
                        emailResults.add("ERROR: Batch send failed (regular) - " + e.getMessage());
                    }
                }

                // --- Send Attachment Email Batches ---
                if (!attachmentBatchMap.isEmpty()) {
                    List<AttachmentNotificationDTO> finalAttachmentList = new ArrayList<>(attachmentBatchMap.values());
                    try {
                        notificationService.sendAttachmentEmail(finalAttachmentList, finalInstituteId);
                        emailResults.add("Attachment batch send successful.");
                        log.info("Successfully dispatched {} attachment email batches.", finalAttachmentList.size());
                    } catch (Exception e) {
                        log.error("Error sending attachment email batch request", e);
                        emailResults.add("ERROR: Batch send failed (attachment) - " + e.getMessage());
                    }
                }

                if (regularBatchMap.isEmpty() && attachmentBatchMap.isEmpty()) {
                    log.info("No valid, non-duplicate email requests to send.");
                    changes.put("status", "no_requests_sent");
                    return changes;
                }

                changes.put("email_requests_processed", processedCount);
                changes.put("email_requests_skipped", skippedCount);
                changes.put("regular_batches_sent", regularBatchMap.size());
                changes.put("attachment_batches_sent", attachmentBatchMap.size());
                changes.put("email_results", emailResults);
                changes.put("status", "emails_sent");
                log.info("Successfully processed {} email requests.", processedCount);

            } else {
                changes.put("status", "no_requests_created");
            }
            // --- BATCHING LOGIC END ---

        } catch (Exception e) {
            log.error("Error handling SendEmail node", e);
            changes.put("status", "error");
            changes.put("error", e.getMessage());
        }

        return changes;
    }

    private List<Map<String, Object>> processForEachOperation(ForEachConfigDTO forEachConfig,
                                                              Map<String, Object> itemContext, Object item) {
        if (forEachConfig == null) {
            log.warn("No forEach configuration found in SendEmail node");
            return Collections.emptyList();
        }

        String operation = forEachConfig.getOperation();

        // --- NEW: Handle ATTACHMENT_EMAIL operation ---
        if ("ATTACHMENT_EMAIL".equalsIgnoreCase(operation)) {
            return processAttachmentEmailOperation(forEachConfig, itemContext, item);
        }

        if ("SWITCH".equalsIgnoreCase(operation)) {
            return processSwitchOperation(forEachConfig, itemContext, item);
        }

        // Default to regular email
        return processRegularEmailOperation(forEachConfig, itemContext, item);
    }

    // --- NEW: Method to handle regular email (template or hardcoded) ---
    private List<Map<String, Object>> processRegularEmailOperation(ForEachConfigDTO forEachConfig,
                                                                   Map<String, Object> itemContext, Object item) {
        String emailDataExpr = forEachConfig.getEval();
        if (emailDataExpr == null || emailDataExpr.isBlank()) {
            log.warn("SEND_EMAIL forEach missing 'eval' expression for email data");
            return Collections.emptyList();
        }

        try {
            Object emailDataObj = spelEvaluator.evaluate(emailDataExpr, itemContext);
            if (emailDataObj == null) {
                log.warn("No email data found for expression: {}", emailDataExpr);
                return Collections.emptyList();
            }

            return processEmailDataAndCreateRequests(emailDataObj, itemContext, "REGULAR");
        } catch (Exception e) {
            log.error("Error processing regular email forEach operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    // --- NEW: Method to handle attachment email ---
    private List<Map<String, Object>> processAttachmentEmailOperation(ForEachConfigDTO forEachConfig,
                                                                      Map<String, Object> itemContext, Object item) {
        String emailDataExpr = forEachConfig.getEval();
        if (emailDataExpr == null || emailDataExpr.isBlank()) {
            log.warn("ATTACHMENT_EMAIL forEach missing 'eval' expression");
            return Collections.emptyList();
        }

        try {
            Object emailDataObj = spelEvaluator.evaluate(emailDataExpr, itemContext);
            if (emailDataObj == null) {
                log.warn("No attachment email data found for expression: {}", emailDataExpr);
                return Collections.emptyList();
            }

            // 'item' in this context is the recipient email string
            String recipientEmail = String.valueOf(item);

            // The evaluated object is a list containing one map
            if (emailDataObj instanceof List && !((List) emailDataObj).isEmpty()) {
                Object data = ((List) emailDataObj).get(0);
                if (data instanceof Map) {
                    // --- MODIFIED: Pass itemContext ---
                    Map<String, Object> request = createAttachmentEmailRequest(recipientEmail, (Map<String, Object>) data, itemContext);
                    if (request != null) {
                        return List.of(request);
                    }
                }
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Error processing attachment email forEach operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> processSwitchOperation(ForEachConfigDTO forEachConfig,
                                                             Map<String, Object> itemContext, Object item) {
        try {
            String onExpr = forEachConfig.getOn();
            if (onExpr == null || onExpr.isBlank()) {
                log.warn("SWITCH operation missing 'on' expression");
                return Collections.emptyList();
            }
            Object switchValue = spelEvaluator.evaluate(onExpr, itemContext);
            String key = String.valueOf(switchValue);
            Map<String, Object> cases = forEachConfig.getCases();
            if (cases == null || cases.isEmpty()) {
                log.warn("SWITCH operation missing cases");
                return Collections.emptyList();
            }
            Object selectedCase = cases.get(key);
            if (selectedCase == null) {
                selectedCase = cases.get("default");
                if (selectedCase == null) {
                    log.debug("SWITCH operation no matching case found for key: {}", key);
                    return Collections.emptyList();
                }
            }
            // A switch operation implies a regular email
            return processEmailDataAndCreateRequests(selectedCase, itemContext, "REGULAR");
        } catch (Exception e) {
            log.error("Error processing SWITCH operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> processEmailDataAndCreateRequests(Object emailDataObj,
                                                                        Map<String, Object> itemContext, String type) {
        List<Map<String, Object>> requests = new ArrayList<>();
        try {
            if (emailDataObj instanceof List) {
                List<?> emailDataList = (List<?>) emailDataObj;
                for (Object emailData : emailDataList) {
                    Map<String, Object> request = createEmailRequest(emailData, itemContext, type);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else if (emailDataObj instanceof Map) {
                Map<String, Object> request = createEmailRequest(emailDataObj, itemContext, type);
                if (request != null) {
                    requests.add(request);
                }
            } else {
                log.warn("Email data is neither a list nor a map: {}", emailDataObj.getClass());
            }
        } catch (Exception e) {
            log.error("Error processing email data: {}", emailDataObj, e);
        }
        return requests;
    }

    /**
     * --- MODIFIED: Added template support ---
     */
    private Map<String, Object> createAttachmentEmailRequest(String recipientEmail, Map<String, Object> emailData, Map<String, Object> itemContext) {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("type", "ATTACHMENT_EMAIL");
            request.put("recipient", recipientEmail);
            request.put("attachmentName", emailData.get("attachmentName"));
            request.put("attachmentBase64", emailData.get("attachmentBase64"));

            Map<String, String> finalVars = new HashMap<>();
            finalVars.put("recipient", recipientEmail); // Add recipient as a default placeholder

            // Check if this is template-based
            if (emailData.containsKey("templateName")) {
                String templateName = (String) emailData.get("templateName");
                Map<String, ?> templateVars = (Map<String, ?>) emailData.get("templateVars");
                String instituteId = (String) itemContext.get("instituteId");

                if (!StringUtils.hasText(instituteId)) {
                    instituteId = (String) itemContext.get("instituteIdForWhatsapp");
                }

                if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(templateName)) {
                    log.warn("Skipping attachment template email. Missing instituteId or templateName.");
                    return null;
                }

                String cacheKey = instituteId + ":" + templateName + ":EMAIL";
                final String finalInstituteId = instituteId;
                Template template = templateCache.computeIfAbsent(cacheKey, k ->
                    templateRepository.findByInstituteIdAndNameAndType(finalInstituteId, templateName, "EMAIL")
                        .orElse(null)
                );

                if (template == null) {
                    log.warn("Email template not found: {} for institute: {}", templateName, instituteId);
                    return null;
                }

                if (templateVars != null) {
                    templateVars.forEach((key, value) -> finalVars.put(key, String.valueOf(value)));
                }

                // Add all item context properties as strings for fallback
                itemContext.forEach((key, value) -> {
                    if (value != null) {
                        finalVars.putIfAbsent(key, String.valueOf(value));
                    }
                });

                request.put("subject", template.getSubject());
                request.put("body", template.getContent());

            } else {
                // Fallback to hardcoded subject/body
                request.put("subject", emailData.get("subject"));
                request.put("body", emailData.get("body"));
            }

            request.put("placeholders", finalVars);
            return request;

        } catch (Exception e) {
            log.error("Error creating attachment email request", e);
            return null;
        }
    }

    private Map<String, Object> createEmailRequest(Object emailData, Map<String, Object> itemContext, String type) {
        try {
            Object userDetailsObj = itemContext.get("item");
            if (userDetailsObj == null) {
                log.warn("No user details (item) found in context");
                return null;
            }

            Map<String, Object> userDetails = JsonUtil.convertValue(userDetailsObj, Map.class);
            // We can no longer assume 'item' is a map, it could be a string.
            // extractEmailAddress will handle this.

            String emailAddress = extractEmailAddress(userDetails, itemContext.get("item"));
            if (emailAddress == null || emailAddress.isBlank()) {
                log.warn("No email address found for user: {}", userDetailsObj);
                return null;
            }

            if (!(emailData instanceof Map)) {
                log.warn("Email data is not a map: {}", emailData);
                return null;
            }

            Map<String, Object> emailDataMap = (Map<String, Object>) emailData;
            Map<String, Object> request = new HashMap<>();
            request.put("type", type);
            request.put("recipient", emailAddress);

            // Check for templateName
            if (emailDataMap.containsKey("templateName")) {
                String templateName = (String) emailDataMap.get("templateName");
                Map<String, ?> templateVars = (Map<String, ?>) emailDataMap.get("templateVars");
                String instituteId = (String) itemContext.get("instituteId");

                if (!StringUtils.hasText(instituteId)) {
                    instituteId = (String) itemContext.get("instituteIdForWhatsapp");
                }

                if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(templateName)) {
                    log.warn("Skipping template email. Missing instituteId or templateName.");
                    return null;
                }

                String cacheKey = instituteId + ":" + templateName + ":EMAIL";
                final String finalInstituteId = instituteId;
                final String finalTemplateName = templateName;

                Template template = templateCache.computeIfAbsent(cacheKey, k ->
                    templateRepository.findByInstituteIdAndNameAndType(finalInstituteId, finalTemplateName, "EMAIL")
                        .orElse(null)
                );

                if (template == null) {
                    log.warn("Email template not found: {} for institute: {}", templateName, instituteId);
                    return null;
                }

                Map<String, String> finalVars = new HashMap<>();
                if (templateVars != null) {
                    templateVars.forEach((key, value) -> finalVars.put(key, String.valueOf(value)));
                }
                if (userDetails != null) { // Add item properties if it's a map
                    userDetails.forEach((key, value) -> {
                        if (value != null) {
                            finalVars.putIfAbsent(key, String.valueOf(value));
                        }
                    });
                }

                request.put("subject", template.getSubject());
                request.put("body", template.getContent());
                request.put("placeholders", finalVars);

            }
            // Fallback to hardcoded subject/body
            else if (emailDataMap.containsKey("subject")) {
                String subject = (String) emailDataMap.get("subject");
                String body = (String) emailDataMap.get("body");

                if (subject == null || body == null) {
                    log.warn("Email data missing subject or body");
                    return null;
                }

                String evaluatedSubject = evaluateSpelExpression(subject, itemContext);
                String evaluatedBody = evaluateSpelExpression(body, itemContext);

                request.put("subject", evaluatedSubject);
                request.put("body", evaluatedBody);

                Map<String, String> placeholders = new HashMap<>();
                if (userDetails != null) { // Add item properties if it's a map
                    userDetails.forEach((key, value) -> {
                        if (value != null) {
                            placeholders.put(key, String.valueOf(value));
                        }
                    });
                }
                request.put("placeholders", placeholders);
            } else {
                log.warn("Email data is missing 'templateName' or 'subject'");
                return null;
            }

            return request;

        } catch (Exception e) {
            log.error("Error creating email request", e);
            return null;
        }
    }

    private String evaluateSpelExpression(String expression, Map<String, Object> context) {
        try {
            if (expression == null || expression.isBlank()) {
                return expression;
            }
            if (expression.startsWith("''") && expression.endsWith("''") && expression.length() > 3) {
                expression = expression.substring(1, expression.length() - 1);
            }

            Object result = spelEvaluator.evaluate(expression, context);
            return result != null ? String.valueOf(result) : "";
        } catch (Exception e) {
            log.warn("Error evaluating SPEL expression: {}", expression, e);
            return expression;
        }
    }

    // --- MODIFIED: To handle 'item' being a simple string ---
    private String extractEmailAddress(Map<String, Object> userDetailsMap, Object item) {
        // First, check if 'item' itself is a valid email string.
        // This handles the admin list case where on="#ctx['adminEmailList']"
        if (item instanceof String) {
            String email = ((String) item).trim();
            if (!email.isBlank() && email.contains("@")) {
                return email;
            }
        }

        // If 'item' wasn't an email, check the userDetailsMap
        if (userDetailsMap != null) {
            String[] possibleFields = {
                "email", "emailAddress", "email_address",
                "userEmail", "user_email", "mail", "channelId"
            };

            for (String field : possibleFields) {
                Object value = userDetailsMap.get(field);
                if (value != null) {
                    String email = String.valueOf(value).trim();
                    if (!email.isBlank() && email.contains("@")) {
                        return email;
                    }
                }
            }
        }

        return null; // No valid email found
    }
}
