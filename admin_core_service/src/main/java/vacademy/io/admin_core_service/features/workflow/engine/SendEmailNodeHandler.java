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

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendEmailNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;

    // --- NEWLY ADDED ---
    private final TemplateRepository templateRepository;
    private final Map<String, Template> templateCache = new HashMap<>();
    // --- END NEW ---

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

        // --- NEW: Extract instituteId ---
        String instituteId = (String) context.get("instituteId");
        if (!StringUtils.hasText(instituteId)) {
            // Fallback for whatsapp-specific key if primary one is missing
            instituteId = (String) context.get("instituteIdForWhatsapp");
            if (!StringUtils.hasText(instituteId)) {
                log.warn("SendEmailNode missing 'instituteId' from context");
                changes.put("status", "error");
                changes.put("error", "Missing 'instituteId' from context");
                return changes;
            }
        }
        // --- END NEW ---

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

            List<Map<String, Object>> allEmailRequests = new ArrayList<>();
            for (Object item : items) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                List<Map<String, Object>> itemRequests = processForEachOperation(sendEmailNodeDTO.getForEach(),
                    itemContext, item);
                if (itemRequests != null && !itemRequests.isEmpty()) {
                    allEmailRequests.addAll(itemRequests);
                }
            }

            if (!allEmailRequests.isEmpty()) {
                List<NotificationDTO> notificationDTOs = new ArrayList<>();
                for (Map<String, Object> request : allEmailRequests) {
                    String recipient = (String) request.get("recipient");
                    String subject = (String) request.get("subject");
                    String body = (String) request.get("body");
                    Map<String, String> placeholders = (Map<String, String>) request.get("placeholders"); // <-- NEW

                    if (recipient != null && !recipient.isBlank()) {
                        NotificationDTO notificationDTO = new NotificationDTO();
                        notificationDTO.setSubject(subject);
                        notificationDTO.setBody(body);
                        notificationDTO.setNotificationType("EMAIL");
                        notificationDTO.setSource("WORKFLOW");
                        notificationDTO.setSourceId("send_email_node");

                        NotificationToUserDTO userDTO = new NotificationToUserDTO();
                        userDTO.setChannelId(recipient);
                        userDTO.setUserId(recipient);

                        // --- MODIFIED: Use placeholders from request ---
                        if (placeholders != null && !placeholders.isEmpty()) {
                            userDTO.setPlaceholders(placeholders);
                        } else {
                            // Fallback for old method
                            userDTO.setPlaceholders(Map.of("email", recipient));
                        }
                        // --- END MODIFIED ---

                        notificationDTO.setUsers(Collections.singletonList(userDTO));
                        notificationDTOs.add(notificationDTO);
                    }
                }

                log.info("Created {} NotificationDTO objects for individual emails", notificationDTOs.size());

                // --- MODIFIED: Pass instituteId ---
                List<String> emailResults = new ArrayList<>();
                for (NotificationDTO notificationDTO : notificationDTOs) {
                    try {
                        // Pass instituteId to the service
                        String result = notificationService.sendEmailToUsers(notificationDTO, instituteId);
                        emailResults.add(result);
                        log.debug("Email sent successfully for subject: {}", notificationDTO.getSubject());
                    } catch (Exception e) {
                        log.error("Error sending email for subject: {}", notificationDTO.getSubject(), e);
                        emailResults.add("ERROR: " + e.getMessage());
                    }
                }
                // --- END MODIFIED ---

                changes.put("email_requests", allEmailRequests);
                changes.put("notification_dtos", notificationDTOs);
                changes.put("request_count", allEmailRequests.size());
                changes.put("email_results", emailResults);
                changes.put("status", "emails_sent");
                log.info("Successfully processed and sent {} individual email requests", allEmailRequests.size());
            } else {
                changes.put("status", "no_requests_created");
            }

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
        if ("SWITCH".equalsIgnoreCase(operation)) {
            return processSwitchOperation(forEachConfig, itemContext, item);
        }

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

            // --- MODIFIED: Pass itemContext ---
            return processEmailDataAndCreateRequests(emailDataObj, itemContext, forEachConfig);
        } catch (Exception e) {
            log.error("Error processing forEach operation for item: {}", item, e);
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
            log.debug("SWITCH operation evaluated '{}' to key: {}", onExpr, key);

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

            // --- MODIFIED: Pass itemContext ---
            return processEmailDataAndCreateRequests(selectedCase, itemContext, forEachConfig);
        } catch (Exception e) {
            log.error("Error processing SWITCH operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> processEmailDataAndCreateRequests(Object emailDataObj,
                                                                        // --- MODIFIED: Added itemContext ---
                                                                        Map<String, Object> itemContext, ForEachConfigDTO forEachConfig) {
        List<Map<String, Object>> requests = new ArrayList<>();

        try {
            if (emailDataObj instanceof List) {
                List<?> emailDataList = (List<?>) emailDataObj;
                for (Object emailData : emailDataList) {
                    // --- MODIFIED: Pass itemContext ---
                    Map<String, Object> request = createEmailRequest(emailData, itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else if (emailDataObj instanceof Map) {
                // --- MODIFIED: Pass itemContext ---
                Map<String, Object> request = createEmailRequest(emailDataObj, itemContext, forEachConfig);
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
     * --- MODIFIED: This method is now rewritten to support templateName ---
     */
    private Map<String, Object> createEmailRequest(Object emailData, Map<String, Object> itemContext,
                                                   ForEachConfigDTO forEachConfig) {
        try {
            Object userDetailsObj = itemContext.get("item");
            if (userDetailsObj == null) {
                log.warn("No user details (item) found in context");
                return null;
            }

            Map<String, Object> userDetails = JsonUtil.convertValue(userDetailsObj, Map.class);
            if (userDetails == null) {
                log.warn("Could not convert user details (item) to map");
                return null;
            }

            String emailAddress = extractEmailAddress(userDetails);
            if (emailAddress == null || emailAddress.isBlank()) {
                log.warn("No email address found for user: {}", userDetails);
                return null;
            }

            if (!(emailData instanceof Map)) {
                log.warn("Email data is not a map: {}", emailData);
                return null;
            }

            Map<String, Object> emailDataMap = (Map<String, Object>) emailData;
            Map<String, Object> request = new HashMap<>();
            request.put("recipient", emailAddress);

            // NEW: Check for templateName
            if (emailDataMap.containsKey("templateName")) {
                String templateName = (String) emailDataMap.get("templateName");
                Map<String, String> templateVars = (Map<String, String>) emailDataMap.get("templateVars");
                String instituteId = (String) itemContext.get("instituteId"); // Get from main context

                if (!StringUtils.hasText(instituteId)) {
                    instituteId = (String) itemContext.get("instituteIdForWhatsapp"); // Fallback
                }

                if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(templateName)) {
                    log.warn("Skipping template email. Missing instituteId or templateName.");
                    return null;
                }

                // Fetch template
                String cacheKey = instituteId + ":" + templateName;
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

                // Add all item details to templateVars for replacement
                Map<String, String> finalVars = new HashMap<>();
                if (templateVars != null) {
                    finalVars.putAll(templateVars);
                }
                // Add all properties from 'item' as strings
                userDetails.forEach((key, value) -> {
                    if (value != null) {
                        finalVars.put(key, String.valueOf(value));
                    }
                });


                String processedSubject = replaceTemplatePlaceholders(template.getSubject(), finalVars);
                String processedBody = replaceTemplatePlaceholders(template.getContent(), finalVars);

                request.put("subject", processedSubject);
                request.put("body", processedBody);
                request.put("placeholders", finalVars); // Pass vars to NotificationToUserDTO

            }
            // OLD: Fallback to hardcoded subject/body
            else if (emailDataMap.containsKey("subject")) {
                String subject = (String) emailDataMap.get("subject");
                String body = (String) emailDataMap.get("body");

                if (subject == null || body == null) {
                    log.warn("Email data missing subject or body");
                    return null;
                }

                // Evaluate SPEL expressions in subject and body
                String evaluatedSubject = evaluateSpelExpression(subject, itemContext);
                String evaluatedBody = evaluateSpelExpression(body, itemContext);

                request.put("subject", evaluatedSubject);
                request.put("body", evaluatedBody);
                // No placeholders, as they are already evaluated
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

    /**
     * --- NEW: Helper method to replace placeholders ---
     * Replaces {{placeholder}} in content with values from a map.
     */
    private String replaceTemplatePlaceholders(String content, Map<String, String> parameters) {
        if (content == null || parameters == null) {
            return content;
        }

        String result = content;
        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            // Use a regex-safe placeholder format, e.g., {{name}}
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = entry.getValue() != null ? entry.getValue() : "";
            // We must escape replacements to avoid issues with special chars in the value
            result = result.replace(placeholder, value);
        }

        return result;
    }

    private String evaluateSpelExpression(String expression, Map<String, Object> context) {
        try {
            if (expression == null || expression.isBlank()) {
                return expression;
            }
            // This handles the "''...''" format for SpEL strings
            if (expression.startsWith("''") && expression.endsWith("''") && expression.length() > 3) {
                expression = expression.substring(1, expression.length() - 1);
            }

            Object result = spelEvaluator.evaluate(expression, context);
            return result != null ? String.valueOf(result) : "";
        } catch (Exception e) {
            log.warn("Error evaluating SPEL expression: {}", expression, e);
            return expression; // Return original expression if evaluation fails
        }
    }

    private String extractEmailAddress(Map<String, Object> userDetails) {
        String[] possibleFields = {
            "email", "emailAddress", "email_address",
            "userEmail", "user_email", "mail"
        };

        for (String field : possibleFields) {
            Object value = userDetails.get(field);
            if (value != null) {
                String email = String.valueOf(value).trim();
                if (!email.isBlank() && email.contains("@")) {
                    return email;
                }
            }
        }
        return null;
    }
}
