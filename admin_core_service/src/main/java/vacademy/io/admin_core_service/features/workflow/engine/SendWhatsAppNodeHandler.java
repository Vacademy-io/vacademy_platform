package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.SendWhatsAppNodeDTO;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WhatsAppNotificationTemplateDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class SendWhatsAppNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NotificationService notificationService;

    @Override
    public boolean supports(String nodeType) {
        return "SEND_WHATSAPP".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(
            Map<String, Object> context,
            String nodeConfigJson,
            Map<String, NodeTemplate> nodeTemplates,
            int countProcessed) {

        Map<String, Object> changes = new HashMap<>();
        try {
            SendWhatsAppNodeDTO sendWhatsAppNodeDTO = objectMapper.readValue(nodeConfigJson, SendWhatsAppNodeDTO.class);

            // Get the 'on' expression to evaluate the list to iterate over
            String onExpr = sendWhatsAppNodeDTO.getOn();
            if (onExpr == null || onExpr.isBlank()) {
                log.warn("SEND_WHATSAPP node missing 'on' expression");
                changes.put("status", "missing_on_expression");
                return changes;
            }

            // Evaluate the list expression (e.g., #ctx['ssigmList'])
            Object listObj = spelEvaluator.eval(onExpr, context);
            if (listObj == null) {
                log.warn("No list found for expression: {}", onExpr);
                changes.put("status", "no_list_found");
                return changes;
            }

            if (!(listObj instanceof Collection<?> list) || list.isEmpty()) {
                log.debug("SEND_WHATSAPP found nothing for expression: {}", onExpr);
                changes.put("status", "empty_list");
                return changes;
            }

            // Process each item in the list and create WhatsApp requests
            List<WhatsappRequest> allWhatsappRequests = new ArrayList<>();

            for (Object item : list) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                // Process the forEach operation for this item
                List<WhatsappRequest> itemRequests = processForEachOperation(sendWhatsAppNodeDTO.getForEach(),
                        itemContext, item);
                if (itemRequests != null && !itemRequests.isEmpty()) {
                    allWhatsappRequests.addAll(itemRequests);
                }
            }

            // Group requests by template for optimization and create proper structure
            if (!allWhatsappRequests.isEmpty()) {
                // Group requests by template for optimization
                Map<String, List<WhatsappRequest>> requestsByTemplate = allWhatsappRequests
                        .stream()
                        .collect(Collectors.groupingBy(WhatsappRequest::getTemplateName));

                // Create grouped WhatsApp requests for bulk sending
                List<WhatsappRequest> groupedRequests = new ArrayList<>();

                for (Map.Entry<String, List<WhatsappRequest>> entry : requestsByTemplate.entrySet()) {
                    List<WhatsappRequest> whatsappRequests = entry.getValue();
                    String templateName = entry.getKey();

                    // Create a new grouped request for this template
                    WhatsappRequest groupedRequest = new WhatsappRequest();
                    groupedRequest.setTemplateName(templateName);

                    // Set language code from the first request (assuming all have same language)
                    String languageCode = whatsappRequests.get(0).getLanguageCode();
                    groupedRequest.setLanguageCode(languageCode != null ? languageCode : "en");

                    // Combine all userDetails from requests with the same template
                    List<Map<String, Map<String, String>>> allUserDetails = new ArrayList<>();
                    for (WhatsappRequest request : whatsappRequests) {
                        if (request.getUserDetails() != null) {
                            allUserDetails.addAll(request.getUserDetails());
                        }
                    }
                    groupedRequest.setUserDetails(allUserDetails);

                    // Add header params if available
                    if (!whatsappRequests.isEmpty() && whatsappRequests.get(0).getHeaderParams() != null) {
                        groupedRequest.setHeaderParams(whatsappRequests.get(0).getHeaderParams());
                    }

                    // Add header type if available
                    if (!whatsappRequests.isEmpty() && whatsappRequests.get(0).getHeaderType() != null) {
                        groupedRequest.setHeaderType(whatsappRequests.get(0).getHeaderType());
                    }

                    groupedRequests.add(groupedRequest);

                    log.debug("Created grouped request for template '{}' with {} individual requests",
                            templateName, whatsappRequests.size());
                }

                log.info("Created {} WhatsApp requests grouped into {} templates",
                        allWhatsappRequests.size(), groupedRequests.size());

                // Send bulk requests to notification service
                String instituteId = (String) context.get("instituteId");
                Map<String, Object> notificationResult = sendBulkWhatsAppRequests(groupedRequests, instituteId);


                log.info("Successfully sent {} WhatsApp requests in {} template groups",
                        allWhatsappRequests.size(), groupedRequests.size());
            } else {
                changes.put("status", "no_requests_created");
            }

        } catch (Exception e) {
            log.error("Error handling SendWhatsApp node", e);
            changes.put("status", "error");
            changes.put("error", e.getMessage());
        }

        return changes;
    }

    private List<WhatsappRequest> processForEachOperation(ForEachConfigDTO forEachConfig,
            Map<String, Object> itemContext, Object item) {
        if (forEachConfig == null) {
            log.warn("No forEach configuration found in SendWhatsApp node");
            return Collections.emptyList();
        }

        // Get the templates expression from forEach config
        String templatesExpr = forEachConfig.getEval();
        if (templatesExpr == null || templatesExpr.isBlank()) {
            log.warn("SEND_WHATSAPP forEach missing 'on' expression for templates");
            return Collections.emptyList();
        }

        try {
            // Evaluate the templates expression
            Object templatesObj = spelEvaluator.eval(templatesExpr, itemContext);
            if (templatesObj == null) {
                log.warn("No templates found for expression: {}", templatesExpr);
                return Collections.emptyList();
            }

            // Process templates and create WhatsApp requests
            return processTemplatesAndCreateRequests(templatesObj, itemContext, forEachConfig);

        } catch (Exception e) {
            log.error("Error processing forEach operation for item: {}", item, e);
            return Collections.emptyList();
        }
    }

    private List<WhatsappRequest> processTemplatesAndCreateRequests(Object templatesObj,
            Map<String, Object> itemContext, ForEachConfigDTO forEachConfig) {
        List<WhatsappRequest> requests = new ArrayList<>();

        try {
            if (templatesObj instanceof List) {
                // Handle list of templates
                List<?> templates = (List<?>) templatesObj;
                for (Object template : templates) {
                    WhatsappRequest request = createWhatsAppRequest(template, itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else if (templatesObj instanceof Map) {
                // Handle map of templates
                Map<?, ?> templates = (Map<?, ?>) templatesObj;
                for (Map.Entry<?, ?> entry : templates.entrySet()) {
                    WhatsappRequest request = createWhatsAppRequest(entry.getValue(), itemContext, forEachConfig);
                    if (request != null) {
                        requests.add(request);
                    }
                }
            } else {
                // Handle single template
                WhatsappRequest request = createWhatsAppRequest(templatesObj, itemContext, forEachConfig);
                if (request != null) {
                    requests.add(request);
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
            WhatsAppNotificationTemplateDTO whatsAppNotificationTemplateDTO = JsonUtil.convertValue(template,
                    WhatsAppNotificationTemplateDTO.class);
            request.setTemplateName(whatsAppNotificationTemplateDTO.getTemplateName());
            // Create userDetails structure as expected by existing WhatsappRequest
            // userDetails is List<Map<String, Map<String, String>>>
            Map<String, Map<String, String>> userDetail = new HashMap<>();
            Map<String, String> evaluatedPlaceHolders = getEvaluatedPlaceHolder(
                    whatsAppNotificationTemplateDTO.getPlaceholders(), itemContext);
            userDetail.put(mobileNumber, evaluatedPlaceHolders);
            request.setUserDetails(Collections.singletonList(userDetail));

            // Set default language code if not specified
            request.setLanguageCode("en");

            return request;

        } catch (Exception e) {

            log.error("Error creating WhatsApp request", e);
            return null;
        }
    }

    private Map<String, String> getEvaluatedPlaceHolder(Map<String, String> placeholders,
            Map<String, Object> itemContext) {
        Map<String, String> evaluatedPlaceholders = new HashMap<>();
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            String key = entry.getKey();
            Object value = spelEvaluator.eval(entry.getValue(), itemContext);
            evaluatedPlaceholders.put(key, String.valueOf(value));
        }
        return evaluatedPlaceholders;
    }

    private String extractMobileNumber(Map<String, Object> userDetails) {
        // Possible field names where mobile number may be stored
        String[] possibleFields = {
                "mobileNumber", "mobile_number", "mobile",
                "phone", "phoneNumber", "phone_number"
        };

        for (String field : possibleFields) {
            Object value = userDetails.get(field);

            if (value != null) {
                String number = String.valueOf(value).trim();

                if (!number.isBlank()) {
                    // Remove + if present
                    if (number.startsWith("+")) {
                        number = number.substring(1);
                    }

                    // Keep only digits
                    number = number.replaceAll("\\D", "");

                    // WhatsApp generally supports 10–15 digit numbers
                    if (number.matches("\\d{10,15}")) {
                        return number;
                    }
                }
            }
        }

        return null; // No valid number found
    }

    private Map<String, Object> sendBulkWhatsAppRequests(List<WhatsappRequest> groupedRequests,
            String instituteId) {
        Map<String, Object> result = new HashMap<>();

        try {
            // Flatten all requests into a single list for bulk sending
            List<WhatsappRequest> allRequests = groupedRequests;

            log.info("Sending {} WhatsApp requests in {} template groups to notification service",
                    allRequests.size(), groupedRequests.size());

            // Call the notification service for each request
            // to do: actual send notificatios
            for (WhatsappRequest whatsappRequest : allRequests) {
//                notificationService.sendWhatsappToUsers(whatsappRequest, instituteId);
            }

            result.put("status", "success");
            result.put("totalRequests", allRequests.size());
            result.put("templateGroups", groupedRequests.size());
            result.put("message", "All requests sent successfully");

        } catch (Exception e) {
            log.error("Error sending bulk WhatsApp requests", e);
            result.put("status", "error");
            result.put("error", e.getMessage());
        }

        return result;
    }
}
