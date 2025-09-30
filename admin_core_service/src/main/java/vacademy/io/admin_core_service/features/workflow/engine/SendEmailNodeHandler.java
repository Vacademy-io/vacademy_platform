package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.SendEmailNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendEmailNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;

    @Override
    public boolean supports(String nodeType) {
        return "SEND_EMAIL".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                      String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates,
                                      int countProcessed) {

        log.info("SendEmailNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

        Map<String, Object> changes = new HashMap<>();

        try {
            // Deserialize JSON into DTO
            SendEmailNodeDTO sendEmailNodeDTO = objectMapper.readValue(nodeConfigJson, SendEmailNodeDTO.class);

            // Get the list to iterate over
            String onExpression = sendEmailNodeDTO.getOn();
            if (onExpression == null || onExpression.isBlank()) {
                log.warn("SendEmailNode missing 'on' expression");
                changes.put("status", "error");
                changes.put("error", "Missing 'on' expression");
                return changes;
            }

            // Evaluate the list expression
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

            // Process each item
            for (Object item : items) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                // Process the forEach operation for this item
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

                    if (recipient != null && !recipient.isBlank()) {
                        NotificationDTO notificationDTO = new NotificationDTO();
                        notificationDTO.setSubject(subject);
                        notificationDTO.setBody(body);
                        notificationDTO.setNotificationType("EMAIL");
                        notificationDTO.setSource("WORKFLOW");
                        notificationDTO.setSourceId("send_email_node");

                        // Create NotificationToUserDTO for the single recipient
                        NotificationToUserDTO userDTO = new NotificationToUserDTO();
                        userDTO.setChannelId(recipient); // Email address goes in channelId
                        userDTO.setUserId(recipient); // For now, use email as userId

                        // Create placeholders map for personalization
                        Map<String, String> placeholders = new HashMap<>();
                        placeholders.put("email", recipient);

                        // Add any other placeholders from the request
                        if (request.containsKey("placeholders")) {
                            Object placeholdersObj = request.get("placeholders");
                            if (placeholdersObj instanceof Map) {
                                Map<String, Object> reqPlaceholders = (Map<String, Object>) placeholdersObj;
                                for (Map.Entry<String, Object> placeholder : reqPlaceholders.entrySet()) {
                                    if (placeholder.getValue() != null) {
                                        placeholders.put(placeholder.getKey(),
                                                String.valueOf(placeholder.getValue()));
                                    }
                                }
                            }
                        }

                        userDTO.setPlaceholders(placeholders);
                        notificationDTO.setUsers(Collections.singletonList(userDTO));
                        notificationDTOs.add(notificationDTO);
                    }
                }

                log.info("Created {} NotificationDTO objects for individual emails", notificationDTOs.size());

                // Send emails using notification service
                String instituteId = (String) context.get("instituteId");
                List<String> emailResults = new ArrayList<>();

                for (NotificationDTO notificationDTO : notificationDTOs) {
                    try {
                        String result = notificationService.sendEmailToUsers(notificationDTO, instituteId);
                        emailResults.add(result);
                        log.debug("Email sent successfully for subject: {}", notificationDTO.getSubject());
                    } catch (Exception e) {
                        log.error("Error sending email for subject: {}", notificationDTO.getSubject(), e);
                        emailResults.add("ERROR: " + e.getMessage());
                    }
                }

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

        // Check if this is a SWITCH operation
        String operation = forEachConfig.getOperation();
        if ("SWITCH".equalsIgnoreCase(operation)) {
            return processSwitchOperation(forEachConfig, itemContext, item);
        }

        // Get the email data expression from forEach config
        String emailDataExpr = forEachConfig.getEval();
        if (emailDataExpr == null || emailDataExpr.isBlank()) {
            log.warn("SEND_EMAIL forEach missing 'eval' expression for email data");
            return Collections.emptyList();
        }

        try {
            // Evaluate the email data expression
            Object emailDataObj = spelEvaluator.evaluate(emailDataExpr, itemContext);
            if (emailDataObj == null) {
                log.warn("No email data found for expression: {}", emailDataExpr);
                return Collections.emptyList();
            }

            // Process email data and create email requests
            return processEmailDataAndCreateRequests(emailDataObj, itemContext, forEachConfig);

        } catch (Exception e) {
            log.error("Error processing forEach operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> processSwitchOperation(ForEachConfigDTO forEachConfig,
            Map<String, Object> itemContext, Object item) {
        try {
            // Get the switch expression
            String onExpr = forEachConfig.getOn();
            if (onExpr == null || onExpr.isBlank()) {
                log.warn("SWITCH operation missing 'on' expression");
                return Collections.emptyList();
            }

            // Evaluate the switch expression
            Object switchValue = spelEvaluator.evaluate(onExpr, itemContext);
            String key = String.valueOf(switchValue);
            log.debug("SWITCH operation evaluated '{}' to key: {}", onExpr, key);

            // Get the cases
            Map<String, Object> cases = forEachConfig.getCases();
            if (cases == null || cases.isEmpty()) {
                log.warn("SWITCH operation missing cases");
                return Collections.emptyList();
            }

            // Find matching case
            Object selectedCase = cases.get(key);
            if (selectedCase == null) {
                // Check for default case
                selectedCase = cases.get("default");
                if (selectedCase == null) {
                    log.debug("SWITCH operation no matching case found for key: {}", key);
                    return Collections.emptyList();
                }
            }

            // Process the selected case
            return processEmailDataAndCreateRequests(selectedCase, itemContext, forEachConfig);

        } catch (Exception e) {
            log.error("Error processing SWITCH operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> processEmailDataAndCreateRequests(Object emailDataObj,
            Map<String, Object> itemContext, ForEachConfigDTO forEachConfig) {
        List<Map<String, Object>> requests = new ArrayList<>();

        try {
            if (emailDataObj instanceof List) {
                // Handle list of email data
                List<?> emailDataList = (List<?>) emailDataObj;
                for (Object emailData : emailDataList) {
                    Map<String, Object> request = createEmailRequest(emailData, itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else if (emailDataObj instanceof Map) {
                // Handle single email data object
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

    private Map<String, Object> createEmailRequest(Object emailData, Map<String, Object> itemContext,
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

            // Extract email address
            String emailAddress = extractEmailAddress(userDetails);
            if (emailAddress == null || emailAddress.isBlank()) {
                log.warn("No email address found for user: {}", userDetails);
                return null;
            }

            // Create email request
            Map<String, Object> request = new HashMap<>();

            // Handle email data structure with subject and body
            if (emailData instanceof Map) {
                Map<String, Object> emailDataMap = (Map<String, Object>) emailData;
                String subject = (String) emailDataMap.get("subject");
                String body = (String) emailDataMap.get("body");

                if (subject == null || subject.isBlank()) {
                    log.warn("No subject found in email data: {}", emailData);
                    return null;
                }

                if (body == null || body.isBlank()) {
                    log.warn("No body found in email data: {}", emailData);
                    return null;
                }

                // Evaluate SPEL expressions in subject and body
                String evaluatedSubject = evaluateSpelExpression(subject, itemContext);
                String evaluatedBody = evaluateSpelExpression(body, itemContext);

                request.put("recipient", emailAddress);
                request.put("subject", evaluatedSubject);
                request.put("body", evaluatedBody);

            } else {
                log.warn("Email data is not a map: {}", emailData);
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

            Object result = spelEvaluator.evaluate(expression, context);
            return result != null ? String.valueOf(result) : expression;
        } catch (Exception e) {
            log.warn("Error evaluating SPEL expression: {}", expression, e);
            return expression; // Return original expression if evaluation fails
        }
    }

    private String extractEmailAddress(Map<String, Object> userDetails) {
        // Possible field names where email address may be stored
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

        return null; // No valid email found
    }
}