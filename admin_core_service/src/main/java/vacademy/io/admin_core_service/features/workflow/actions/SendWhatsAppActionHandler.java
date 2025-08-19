package vacademy.io.admin_core_service.features.workflow.actions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendWhatsAppActionHandler implements ActionHandlerService {
    private final NotificationClient notificationClient;
    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;

    @Override
    public String getType() {
        return "SEND_WHATSAPP";
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> item, JsonNode config, Map<String, Object> context) {
        try {
            log.info("SendWhatsAppActionHandler executing for item: {}", item);
            
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
            String key = String.valueOf(spelEvaluator.eval(keyExpr, Map.of("item", item, "ctx", context)));
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
                String templateId = template.path("template").asText();
                
                if (templateId.isBlank()) {
                    log.warn("Template missing template ID: {}", template);
                    continue;
                }

                // Build WhatsApp message body based on template and remaining days
                String messageBody = buildWhatsAppMessage(templateId, item);
                
                log.debug("Sending WhatsApp - Template: {}, Body: {}", templateId, messageBody);

                try {
                    Map<String, Object> result = notificationClient.sendWhatsApp(item, messageBody);
                    results.add(Map.of(
                        "success", true,
                        "template_key", key,
                        "template_id", templateId,
                        "mobile", item.get("mobile_number"),
                        "result", result
                    ));
                    log.info("WhatsApp sent successfully to: {}", item.get("mobile_number"));
                } catch (Exception e) {
                    log.error("Failed to send WhatsApp to: {}", item.get("mobile_number"), e);
                    results.add(Map.of(
                        "success", false,
                        "error", e.getMessage(),
                        "mobile", item.get("mobile_number")
                    ));
                }
            }

            return Map.of(
                "success", results.stream().anyMatch(r -> Boolean.TRUE.equals(r.get("success"))),
                "results", results,
                "templates_processed", results.size()
            );

        } catch (Exception e) {
            log.error("Error in SendWhatsAppActionHandler", e);
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    private String buildWhatsAppMessage(String templateId, Map<String, Object> item) {
        Integer remainingDays = (Integer) item.getOrDefault("remaining_days", 0);
        String name = String.valueOf(item.getOrDefault("full_name", ""));
        String liveLink = String.valueOf(item.getOrDefault("live_link", ""));
        String paymentLink = String.valueOf(item.getOrDefault("payment_link", "https://aanandham.app/pay"));
        
        switch (templateId) {
            case "wa_membership_ended":
                return String.format("🌟 Namasthey %s ji\nYour membership has ended. Renew: %s", name, paymentLink);
                
            case "wa_daily_reminder":
                return String.format("Namasthey %s ji 🌞\nDaily reminder\n🔗 %s", name, liveLink);
                
            case "wa_trial_ended":
                return String.format("🌼 Namasthey %s ji\nYour trial has ended. Join paid: %s", name, paymentLink);
                
            case "wa_default_update":
                if (remainingDays > 2) {
                    return String.format("Hi %s, join today's live: %s", name, liveLink);
                } else if (remainingDays > 0 && remainingDays <= 2) {
                    return String.format("Hi %s, %d days left. Link: %s Pay: %s", name, remainingDays, liveLink, paymentLink);
                } else if (remainingDays == 0) {
                    return String.format("Hi %s, membership ended. Renew: %s", name, paymentLink);
                } else {
                    return String.format("Hi %s, trial ended. Join paid: %s", name, paymentLink);
                }
                
            default:
                return String.format("Hi %s, join today: %s", name, liveLink);
        }
    }
}