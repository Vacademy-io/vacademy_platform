package vacademy.io.admin_core_service.features.workflow.actions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.actions.NotificationClient;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendEmailActionHandler implements ActionHandlerService {
    private final NotificationClient notificationClient;
    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;

    @Override
    public String getType() {
        return "SEND_EMAIL";
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> item, JsonNode config, Map<String, Object> context) {
        try {
            log.info("SendEmailActionHandler executing for item: {}", item);

            // Get matrix configuration
            JsonNode matrix = config.path("matrix");
            if (matrix.isMissingNode()) {
                return Map.of("success", false, "error", "No matrix configuration found");
            }

            // Get the key expression to determine which template to use
            String keyExpr = matrix.path("key").asText();
            if (keyExpr.isBlank()) {
                return Map.of("success", false, "error", "No key expression found in matrix");
            }

            // Evaluate the key to get the template category
            String key = String.valueOf(spelEvaluator.evaluate(keyExpr, Map.of("item", item, "ctx", context)));
            log.debug("Matrix key evaluated to: {}", key);

            // Get templates for this key, fallback to DEFAULT if not found
            JsonNode templates = matrix.get(key);
            if (templates == null || templates.isMissingNode()) {
                templates = matrix.get("DEFAULT");
                if (templates == null || templates.isMissingNode()) {
                    return Map.of("success", false, "error", "No templates found for key: " + key);
                }
                log.debug("Using DEFAULT template for key: {}", key);
            }

            List<Map<String, Object>> results = new ArrayList<>();

            // Process each template for this key
            for (JsonNode template : templates) {
                String subject = template.path("subject").asText();
                String body = template.path("body").asText();

                if (subject.isBlank() || body.isBlank()) {
                    log.warn("Template missing subject or body: {}", template);
                    continue;
                }


                // Create NotificationDTO and send
                NotificationDTO notificationDTO = new NotificationDTO();
                notificationDTO.setSubject(subject);
                notificationDTO.setBody(body);
                notificationDTO.setNotificationType("EMAIL");
                notificationDTO.setSource("WORKFLOW");
                notificationDTO.setSourceId("action_handler");

                // Create NotificationToUserDTO for this user
                NotificationToUserDTO userDTO = new NotificationToUserDTO();
                userDTO.setUserId(String.valueOf(item.get("user_id")));
                userDTO.setChannelId(String.valueOf(item.get("email")));

                // Set placeholders for template variables
                Map<String, String> placeholders = new HashMap<>();
                userDTO.setPlaceholders(placeholders);

                notificationDTO.setUsers(Collections.singletonList(userDTO));

                try {
                    Map<String, Object> result = notificationClient.sendEmail(notificationDTO);
                    results.add(Map.of(
                            "success", true,
                            "template_key", key,
                            "email", item.get("email"),
                            "subject", subject,
                            "result", result));
                    log.info("Email sent successfully to: {}", item.get("email"));
                } catch (Exception e) {
                    log.error("Failed to send email to: {}", item.get("email"), e);
                    results.add(Map.of(
                            "success", false,
                            "error", e.getMessage(),
                            "email", item.get("email")));
                }
            }

            return Map.of(
                    "success", results.stream().anyMatch(r -> Boolean.TRUE.equals(r.get("success"))),
                    "results", results,
                    "templates_processed", results.size());

        } catch (Exception e) {
            log.error("Error in SendEmailActionHandler", e);
            return Map.of("success", false, "error", e.getMessage());
        }
    }

}
