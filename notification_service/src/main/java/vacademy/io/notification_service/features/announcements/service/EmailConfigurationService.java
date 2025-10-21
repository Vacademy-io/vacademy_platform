package vacademy.io.notification_service.features.announcements.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.features.announcements.dto.EmailConfigDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Service for managing email configurations and providing dropdown options
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailConfigurationService {
    
    private final InstituteInternalService instituteInternalService;
    private final ObjectMapper objectMapper;
    
    /**
     * Get available email configurations for dropdown
     */
    public List<EmailConfigDTO> getEmailConfigurations(String instituteId) {
        List<EmailConfigDTO> configurations = new ArrayList<>();
        
        try {
            // Get institute settings
            var institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (institute != null && institute.getSetting() != null) {
                // Parse institute email settings and build configurations
                configurations = parseInstituteEmailSettings(institute.getSetting());
            }
            
            // Add default configurations if none found
            if (configurations.isEmpty()) {
                log.warn("No email configurations found for institute: {}, returning defaults", instituteId);
                configurations = getDefaultEmailConfigurations();
            }
            
        } catch (Exception e) {
            log.error("Error getting email configurations for institute: {}", instituteId, e);
            configurations = getDefaultEmailConfigurations();
        }
        
        return configurations;
    }
    
    /**
     * Parse institute settings to extract email configurations
     */
    private List<EmailConfigDTO> parseInstituteEmailSettings(String settingsJson) {
        List<EmailConfigDTO> configs = new ArrayList<>();
        
        try {
            JsonNode settings = objectMapper.readTree(settingsJson);
            
            // Navigate to EMAIL_SETTING.data
            JsonNode emailSettingsData = settings
                    .path(NotificationConstants.SETTING)
                    .path(NotificationConstants.EMAIL_SETTING)
                    .path(NotificationConstants.DATA);
            
            if (!emailSettingsData.isMissingNode() && emailSettingsData.isObject()) {
                log.info("Found EMAIL_SETTING.data, parsing email configurations...");
                
                // Iterate through all email configurations
                Iterator<Map.Entry<String, JsonNode>> fields = emailSettingsData.fields();
                while (fields.hasNext()) {
                    Map.Entry<String, JsonNode> entry = fields.next();
                    String emailType = entry.getKey();
                    JsonNode configNode = entry.getValue();
                    
                    // Extract fields from each email configuration
                    String fromEmail = configNode.path(NotificationConstants.FROM).asText("");
                    String username = configNode.path(NotificationConstants.USERNAME).asText("");
                    
                    // Build EmailConfigDTO
                    EmailConfigDTO dto = EmailConfigDTO.builder()
                            .email(fromEmail)
                            .name(formatEmailTypeName(emailType))
                            .type(emailType)
                            .description("Email configuration for " + formatEmailTypeName(emailType))
                            .displayText(formatEmailTypeName(emailType))
                            .build();
                    
                    configs.add(dto);
                    log.info("Parsed email config: type={}, from={}", emailType, fromEmail);
                }
            } else {
                log.warn("EMAIL_SETTING.data not found or not an object in settings JSON");
            }
            
        } catch (Exception e) {
            log.error("Error parsing institute email settings", e);
        }
        
        return configs;
    }
    
    /**
     * Format email type name for display
     */
    private String formatEmailTypeName(String emailType) {
        if (emailType == null) return "";
        
        // Convert DEVELOPER_EMAIL to "Developer Email"
        String formatted = emailType.replace("_", " ").toLowerCase();
        
        // Capitalize first letter of each word
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        
        for (char c : formatted.toCharArray()) {
            if (Character.isWhitespace(c)) {
                capitalizeNext = true;
                result.append(c);
            } else if (capitalizeNext) {
                result.append(Character.toUpperCase(c));
                capitalizeNext = false;
            } else {
                result.append(c);
            }
        }
        
        return result.toString();
    }
    
    /**
     * Add new email configuration
     */
    public EmailConfigDTO addEmailConfiguration(String instituteId, EmailConfigDTO emailConfig, String authToken) {
        try {
            log.info("Adding email configuration for institute: {}, type: {}", instituteId, emailConfig.getType());
            
            // Validate input
            if (emailConfig.getEmail() == null || emailConfig.getEmail().isEmpty()) {
                throw new IllegalArgumentException("Email address is required");
            }
            if (emailConfig.getType() == null || emailConfig.getType().isEmpty()) {
                throw new IllegalArgumentException("Email type is required");
            }
            
            // Get current settings
            var institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (institute == null) {
                throw new IllegalArgumentException("Institute not found: " + instituteId);
            }
            
            String currentSettings = institute.getSetting();
            if (currentSettings == null || currentSettings.trim().isEmpty()) {
                currentSettings = "{}";
            }
            
            JsonNode settingsNode = objectMapper.readTree(currentSettings);
            ObjectNode rootNode = (ObjectNode) settingsNode;
            
            // Ensure EMAIL_SETTING.data structure exists
            ensureEmailSettingsDataStructure(rootNode);
            
            // Get EMAIL_SETTING.data node
            ObjectNode emailData = (ObjectNode) rootNode
                    .path(NotificationConstants.SETTING)
                    .path(NotificationConstants.EMAIL_SETTING)
                    .path(NotificationConstants.DATA);
            
            // Check if email type already exists
            if (emailData.has(emailConfig.getType())) {
                throw new IllegalArgumentException("Email type '" + emailConfig.getType() + "' already exists. Use PUT to update.");
            }
            
            // Create new email configuration node
            ObjectNode newConfigNode = objectMapper.createObjectNode();
            newConfigNode.put(NotificationConstants.FROM, emailConfig.getEmail());
            newConfigNode.put(NotificationConstants.HOST, "smtp.gmail.com");
            newConfigNode.put(NotificationConstants.PORT, 587);
            newConfigNode.put(NotificationConstants.USERNAME, "SMTP_USERNAME");
            newConfigNode.put(NotificationConstants.PASSWORD, "SMTP_PASSWORD");
            
            // Add to EMAIL_SETTING.data
            emailData.set(emailConfig.getType(), newConfigNode);
            
            // Convert back to JSON string
            String updatedSettings = objectMapper.writeValueAsString(rootNode);
            
            // Update in database
            boolean updated = instituteInternalService.updateInstituteSettings(instituteId, updatedSettings, authToken);
            
            if (!updated) {
                log.warn("Failed to persist email configuration to database for institute: {}", instituteId);
                log.info("Manual update required. Updated settings JSON:\n{}", updatedSettings);
            } else {
                log.info("Successfully added email configuration: {} for institute: {}", emailConfig.getType(), instituteId);
            }
            
            return emailConfig;
            
        } catch (Exception e) {
            log.error("Error adding email configuration", e);
            throw new RuntimeException("Failed to add email configuration: " + e.getMessage(), e);
        }
    }
    
    /**
     * Ensure EMAIL_SETTING.data structure exists in settings
     */
    private void ensureEmailSettingsDataStructure(ObjectNode rootNode) {
        // Ensure "setting" exists
        if (!rootNode.has(NotificationConstants.SETTING) || 
            !(rootNode.get(NotificationConstants.SETTING) instanceof ObjectNode)) {
            rootNode.set(NotificationConstants.SETTING, objectMapper.createObjectNode());
        }
        ObjectNode settingNode = (ObjectNode) rootNode.get(NotificationConstants.SETTING);
        
        // Ensure "EMAIL_SETTING" exists
        if (!settingNode.has(NotificationConstants.EMAIL_SETTING) || 
            !(settingNode.get(NotificationConstants.EMAIL_SETTING) instanceof ObjectNode)) {
            settingNode.set(NotificationConstants.EMAIL_SETTING, objectMapper.createObjectNode());
        }
        ObjectNode emailSettingNode = (ObjectNode) settingNode.get(NotificationConstants.EMAIL_SETTING);
        
        // Ensure "data" exists
        if (!emailSettingNode.has(NotificationConstants.DATA) || 
            !(emailSettingNode.get(NotificationConstants.DATA) instanceof ObjectNode)) {
            emailSettingNode.set(NotificationConstants.DATA, objectMapper.createObjectNode());
        }
    }
    
    /**
     * Get default email configurations
     */
    private List<EmailConfigDTO> getDefaultEmailConfigurations() {
        List<EmailConfigDTO> configs = new ArrayList<>();
        
        // Marketing email
        configs.add(EmailConfigDTO.builder()
            .email("info@example.com")
            .name("Marketing Team")
            .type("MARKETING_EMAIL")
            .description("Marketing and promotional emails")
            .displayText("Marketing Email")
            .build());
            
        // Utility email
        configs.add(EmailConfigDTO.builder()
            .email("notifications@example.com")
            .name("Notifications")
            .type("UTILITY_EMAIL")
            .description("Utility and system notifications")
            .displayText("Utility Email")
            .build());
            
        // Developer email
        configs.add(EmailConfigDTO.builder()
            .email("developer@example.com")
            .name("Developer")
            .type("DEVELOPER_EMAIL")
            .description("Developer and technical notifications")
            .displayText("Developer Email")
            .build());
            
        return configs;
    }
}
