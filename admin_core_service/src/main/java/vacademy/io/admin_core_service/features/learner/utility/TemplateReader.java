package vacademy.io.admin_core_service.features.learner.utility;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class TemplateReader {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private NotificationService notificationService;

    public String getEmailBody(String jsonSetting, String name, String uniqueLink) {
        String template;
        try {
            JsonNode root = objectMapper.readTree(jsonSetting);

            // Log the root to debug
            System.out.println(root.toPrettyString());

            JsonNode welcomeMailDataNode = root.path("setting")
                    .path("WELCOME_MAIL_SETTING")
                    .path("data");

            boolean allowUniqueLink = welcomeMailDataNode.path("allowUniqueLink").asBoolean(false);

            JsonNode templateNode = null;
            if (allowUniqueLink) {
                templateNode = welcomeMailDataNode.path("template");
            }

            if (templateNode.isMissingNode() || templateNode.asText().isEmpty()) {
                throw new VacademyException("Email template not found in settings.");
            }

            template = templateNode.asText();

        } catch (Exception e) {
            throw new VacademyException("Error parsing email settings: ");
        }

        // Replace placeholders
        return template.replace("{name}", name)
                .replace("{unique_link}", uniqueLink);
    }


    public String sendWhatsAppMessage(String jsonSetting, UserDTO user, String uniqueLink,String instituteId) {
        try {
            JsonNode whatsappNode = objectMapper.readTree(jsonSetting)
                    .path("setting")
                    .path("WHATSAPP_WELCOME_SETTING")
                    .path("data");

            if (whatsappNode.isMissingNode()) {
                throw new VacademyException("WHATSAPP_WELCOME_SETTING not found in settings");
            }

            boolean allowUniqueLink = whatsappNode.path("allowUniqueLink").asBoolean(false);
            if (!allowUniqueLink) {
                return "WhatsApp sending skipped because allowUniqueLink is false";
            }
            // Create request
            WhatsappRequest request = new WhatsappRequest();
            request.setTemplateName(whatsappNode.path("templateName").asText());
            request.setLanguageCode(whatsappNode.path("languageCode").asText("en")); // default "en"

            // Prepare placeholders
            List<Map<String, Map<String, String>>> bodyParams = new ArrayList<>();
            Map<String, String> params = new HashMap<>();
            params.put("1", user.getFullName());
            params.put("2", uniqueLink);

            Map<String, Map<String, String>> singleUser = new HashMap<>();
            singleUser.put(user.getMobileNumber(), params);

            bodyParams.add(singleUser);
            request.setUserDetails(bodyParams);

            // Send WhatsApp
            notificationService.sendWhatsappToUsers(request,instituteId);

            return "WhatsApp notification sent";
        } catch (Exception e) {
            throw new VacademyException("WhatsApp sending failed: ");
        }
    }

}
