package vacademy.io.admin_core_service.features.learner.utility;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.learner.constants.TemplateConstants;
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

    public String getEmailBody(String jsonSetting,String templateType) {
        String template;
        try {
            JsonNode root = objectMapper.readTree(jsonSetting);
            System.out.println(root.toPrettyString());
            if(!root.has(TemplateConstants.SETTING) ||
                    !root.path(TemplateConstants.SETTING).has(TemplateConstants.WELCOME_MAIL_SETTING) ||
                    !root.path(TemplateConstants.SETTING)
                            .path(TemplateConstants.WELCOME_MAIL_SETTING)
                            .has(TemplateConstants.DATA)){
                return null;
            }

            JsonNode welcomeMailDataNode = root.path(TemplateConstants.SETTING)
                    .path(TemplateConstants.WELCOME_MAIL_SETTING)
                    .path(TemplateConstants.DATA);

            boolean allowUniqueLink = welcomeMailDataNode.path(TemplateConstants.ALLOW_UNIQUE_LINK)
                    .asBoolean(false);
            JsonNode templateNode = null;
            if (allowUniqueLink) {
                templateNode = welcomeMailDataNode.path(templateType);
            }
            if (templateNode.isMissingNode() || templateNode.asText().isEmpty()) {
                throw new VacademyException("Email template not found in settings.");
            }
            template = templateNode.asText();

        } catch (Exception e) {
            throw new VacademyException("Error parsing email settings: ");
        }

        // Replace placeholders
        return template;
    }

    public String sendWhatsAppMessage(String jsonSetting, UserDTO user, String uniqueLink,String instituteId,String templateType) {
        try {
            JsonNode rootNode=objectMapper.readTree(jsonSetting);
            if (!rootNode.has(TemplateConstants.SETTING) ||
                    !rootNode.path(TemplateConstants.SETTING).has(TemplateConstants.WHATSAPP_WELCOME_SETTING) ||
                    !rootNode.path(TemplateConstants.SETTING)
                            .path(TemplateConstants.WHATSAPP_WELCOME_SETTING)
                            .has(TemplateConstants.DATA)){
                    return null;
            }
            JsonNode whatsappNode = objectMapper.readTree(jsonSetting)
                    .path(TemplateConstants.SETTING)
                    .path(TemplateConstants.WHATSAPP_WELCOME_SETTING)
                    .path(TemplateConstants.DATA);

            if (whatsappNode.isMissingNode()) {
                throw new VacademyException("WHATSAPP_WELCOME_SETTING not found in settings");
            }

            boolean allowUniqueLink = whatsappNode.path(TemplateConstants.ALLOW_UNIQUE_LINK).asBoolean(false);
            if (!allowUniqueLink) {
                return "WhatsApp sending skipped because allowUniqueLink is false";
            }
            // Create request
            WhatsappRequest request = new WhatsappRequest();
            request.setTemplateName(whatsappNode.path(templateType).asText());
            request.setLanguageCode(whatsappNode.path(TemplateConstants.LANGUAGE_CODE)
                    .asText(TemplateConstants.DEFAULT_LANGUAGE));
            String scheduleTime=whatsappNode.path("time").asText();
            // Prepare placeholders
            List<Map<String, Map<String, String>>> bodyParams = new ArrayList<>();
            Map<String, String> params = new HashMap<>();
            params.put("1", user.getFullName());
            params.put("2",scheduleTime);
            params.put("3", uniqueLink);

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
    public String getLearnerDashBoardUrl(String jsonSetting) {
        String url = "";
        try {
            JsonNode root = objectMapper.readTree(jsonSetting);

            // Debug log
            System.out.println(root.toPrettyString());
            if (!root.has(TemplateConstants.SETTING) ||
                    !root.path(TemplateConstants.SETTING).has(TemplateConstants.LEARNER_DASHBOARD_SETTINGS) ||
                    !root.path(TemplateConstants.SETTING)
                            .path(TemplateConstants.LEARNER_DASHBOARD_SETTINGS)
                            .has(TemplateConstants.DATA) ||
                    !root.path(TemplateConstants.SETTING)
                            .path(TemplateConstants.LEARNER_DASHBOARD_SETTINGS)
                            .path(TemplateConstants.DATA)
                            .has(TemplateConstants.LEARNER_DASHBOARD_URL)) {
                return null;
            }

            JsonNode learnerDashBoardUrl = root.path(TemplateConstants.SETTING)
                    .path(TemplateConstants.LEARNER_DASHBOARD_SETTINGS)
                    .path(TemplateConstants.DATA)
                    .path(TemplateConstants.LEARNER_DASHBOARD_URL);

            if (learnerDashBoardUrl.isMissingNode() || learnerDashBoardUrl.asText().isEmpty()) {
                throw new VacademyException("Url not found in settings.");
            }
            url = learnerDashBoardUrl.asText();

        } catch (Exception e) {
            throw new VacademyException("Error parsing learner dashboard settings: " + e.getMessage());
        }

        return url;
    }


}
