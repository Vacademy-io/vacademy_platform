package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.workflow.dto.CombotNodeDTO;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CombotNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${notification.service.url:http://localhost:8076}")
    private String notificationServiceUrl;

    @Override
    public boolean supports(String nodeType) {
        return "COMBOT".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                      String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates,
                                      int countProcessed) {

        log.info("CombotNodeHandler.handle() invoked.");
        Map<String, Object> changes = new HashMap<>();

        try {
            // 1. Parse Config
            CombotNodeDTO nodeDTO = objectMapper.readValue(nodeConfigJson, CombotNodeDTO.class);
            String onExpression = nodeDTO.getOn();

            if (!StringUtils.hasText(onExpression)) {
                log.warn("CombotNode missing 'on' expression");
                changes.put("status", "error");
                changes.put("error", "Missing 'on' expression");
                return changes;
            }

            // 2. Evaluate List (e.g., users)
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

            String instituteId = (String) context.get("instituteId");
            if (!StringUtils.hasText(instituteId)) {
                log.warn("Missing 'instituteId' in context");
                changes.put("status", "error");
                changes.put("error", "Missing 'instituteId' in context");
                return changes;
            }

            // 3. Process Items & Build Messages
            List<Map<String, Object>> messagesList = new ArrayList<>();
            int processedCount = 0;

            for (Object item : items) {
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                // This generic method handles SWITCH or ITERATOR logic if defined in forEach
                // It expects the 'eval' expression to return a Map with keys: userId, to, templateName, params, languageCode
                List<Map<String, Object>> messageDataList = processForEachOperation(nodeDTO.getForEach(), itemContext);

                for (Map<String, Object> msgData : messageDataList) {
                    try {
                        Map<String, Object> messagePayload = buildSingleMessagePayload(msgData);
                        if (messagePayload != null) {
                            messagesList.add(messagePayload);
                            processedCount++;
                        }
                    } catch (Exception e) {
                        log.error("Failed to build Combot message for item: {}", item, e);
                    }
                }
            }

            // 4. Send Batch to Notification Service
            if (!messagesList.isEmpty()) {
                Map<String, Object> finalPayload = new HashMap<>();
                finalPayload.put("instituteId", instituteId);
                finalPayload.put("messages", messagesList);

                sendToNotificationService(finalPayload);

                changes.put("status", "completed");
                changes.put("sent_count", processedCount);
                changes.put("results", "Successfully dispatched " + processedCount + " messages.");
            } else {
                changes.put("status", "completed");
                changes.put("sent_count", 0);
                changes.put("results", "No messages generated.");
            }

        } catch (Exception e) {
            log.error("Error handling CombotNode", e);
            changes.put("status", "error");
            changes.put("error", e.getMessage());
        }

        return changes;
    }

    private Map<String, Object> buildSingleMessagePayload(Map<String, Object> data) {
        String userId = (String) data.get("userId");
        String toNumber = (String) data.get("to");
        String templateName = (String) data.get("templateName");
        String languageCode = (String) data.getOrDefault("languageCode", "en");
        List<String> params = (List<String>) data.get("params"); // Body parameters

        if (!StringUtils.hasText(userId) || !StringUtils.hasText(toNumber) || !StringUtils.hasText(templateName)) {
            log.warn("Skipping message: Missing required fields (userId, to, or templateName). Data: {}", data);
            return null;
        }

        // Build Parameters List
        List<Map<String, String>> parameterComponents = new ArrayList<>();
        if (params != null) {
            for (String paramText : params) {
                parameterComponents.add(Map.of("type", "text", "text", paramText));
            }
        }

        // Build Inner Payload (Meta Structure)
        Map<String, Object> templateMap = new HashMap<>();
        templateMap.put("name", templateName);
        templateMap.put("language", Map.of("code", languageCode));

        // Add body component only if parameters exist
        if (!parameterComponents.isEmpty()) {
            Map<String, Object> bodyComponent = new HashMap<>();
            bodyComponent.put("type", "body");
            bodyComponent.put("parameters", parameterComponents);
            templateMap.put("components", List.of(bodyComponent));
        } else {
            templateMap.put("components", Collections.emptyList());
        }

        Map<String, Object> innerPayload = new HashMap<>();
        innerPayload.put("messaging_product", "whatsapp");
        innerPayload.put("to", toNumber);
        innerPayload.put("type", "template");
        innerPayload.put("template", templateMap);

        // Build Wrapper matching the MessageInfo structure in WhatsAppTemplateRequest
        Map<String, Object> messageWrapper = new HashMap<>();
        messageWrapper.put("userId", userId);
        messageWrapper.put("payload", innerPayload);

        return messageWrapper;
    }

    private void sendToNotificationService(Map<String, Object> payload) {
        // Updated URL to match CombotMessagingController
        String url = notificationServiceUrl + "/notification-service/v1/combot/send-template";
        log.info("Sending Combot batch payload to: {}", url);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        try {
            restTemplate.postForEntity(url, request, Map.class);
            log.info("Combot batch sent successfully.");
        } catch (Exception e) {
            log.error("Failed to send Combot batch: {}", e.getMessage());
            throw new RuntimeException("Notification service call failed: " + e.getMessage());
        }
    }

    /**
     * Evaluates the 'eval' expression from config to get message details.
     */
    private List<Map<String, Object>> processForEachOperation(ForEachConfigDTO forEachConfig,
                                                              Map<String, Object> itemContext) {
        if (forEachConfig == null) {
            return Collections.emptyList();
        }

        String evalExpression = forEachConfig.getEval();
        if (!StringUtils.hasText(evalExpression)) {
            log.warn("Combot forEach missing 'eval' expression");
            return Collections.emptyList();
        }

        try {
            // The expression should return a Map (or List of Maps) containing:
            // userId, to, templateName, params (List<String>), languageCode
            Object evalResult = spelEvaluator.evaluate(evalExpression, itemContext);

            if (evalResult instanceof List) {
                return (List<Map<String, Object>>) evalResult;
            } else if (evalResult instanceof Map) {
                return List.of((Map<String, Object>) evalResult);
            } else if (evalResult != null) {
                log.warn("Eval expression did not return a Map or List. Got: {}", evalResult.getClass().getName());
            }
        } catch (Exception e) {
            log.error("Error processing forEach operation for item", e);
        }

        return Collections.emptyList();
    }
}