package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class SendPushNotificationNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean supports(String nodeType) {
        return "SEND_PUSH_NOTIFICATION".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);

            // Dry-run check
            Boolean dryRun = (Boolean) context.getOrDefault("dryRun", false);
            if (Boolean.TRUE.equals(dryRun)) {
                log.info("[DRY RUN] SEND_PUSH_NOTIFICATION: skipping. Config: {}", nodeConfigJson);
                result.put("dryRun", true);
                result.put("skipped", "push_notification");
                return result;
            }

            String titleExpr = config.path("title").asText("");
            String bodyExpr = config.path("body").asText("");
            String recipientExpr = config.path("recipientTokenExpression").asText("");

            if (titleExpr.isBlank() || bodyExpr.isBlank() || recipientExpr.isBlank()) {
                result.put("error", "Missing required fields: title, body, and recipientTokenExpression");
                return result;
            }

            // Evaluate SpEL expressions
            String title = titleExpr.startsWith("#") ?
                    String.valueOf(spelEvaluator.evaluate(titleExpr, context)) : titleExpr;
            String body = bodyExpr.startsWith("#") ?
                    String.valueOf(spelEvaluator.evaluate(bodyExpr, context)) : bodyExpr;
            Object recipientObj = spelEvaluator.evaluate(recipientExpr, context);

            List<String> tokens = new ArrayList<>();
            if (recipientObj instanceof Collection) {
                for (Object item : (Collection<?>) recipientObj) {
                    tokens.add(String.valueOf(item));
                }
            } else if (recipientObj instanceof String) {
                tokens.add((String) recipientObj);
            }

            if (tokens.isEmpty()) {
                log.warn("SEND_PUSH_NOTIFICATION: no recipient tokens found");
                result.put("error", "No recipient tokens resolved");
                return result;
            }

            // Parse optional data payload
            Map<String, String> data = new HashMap<>();
            JsonNode dataNode = config.path("data");
            if (dataNode.isObject()) {
                dataNode.fields().forEachRemaining(entry ->
                        data.put(entry.getKey(), entry.getValue().asText()));
            }

            // TODO: Integrate with actual FCM/APNs push service
            // For now, log the push notification details
            log.info("SEND_PUSH_NOTIFICATION: title='{}', body='{}', tokens={}, data={}",
                    title, body, tokens.size(), data);

            result.put("title", title);
            result.put("body", body);
            result.put("recipientCount", tokens.size());
            result.put("data", data);
            result.put("status", "dispatched");
            result.put("note", "Push notification service integration pending. Details logged.");

        } catch (Exception e) {
            log.error("Error in SendPushNotificationNodeHandler", e);
            result.put("error", "SendPushNotificationNodeHandler error: " + e.getMessage());
        }
        return result;
    }
}
