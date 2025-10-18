package vacademy.io.notification_service.features.announcements.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
            JsonNode emailConfigs = settings
                .path(NotificationConstants.SETTING)
                .path(NotificationConstants.EMAIL_SETTING)
                .path(NotificationConstants.DATA)
                .path("EMAIL_CONFIGURATIONS");
            
            if (!emailConfigs.isMissingNode()) {
                Iterator<String> fieldNames = emailConfigs.fieldNames();
                while (fieldNames.hasNext()) {
                    String emailType = fieldNames.next();
                    JsonNode emailConfig = emailConfigs.path(emailType);
                    
                    // Only include enabled configurations
                    if (emailConfig.path("enabled").asBoolean(true)) {
                        EmailConfigDTO config = EmailConfigDTO.builder()
                            .email(emailConfig.path("email").asText())
                            .name(emailConfig.path("name").asText())
                            .type(emailType)
                            .description(emailConfig.path("description").asText())
                            .build();
                        configs.add(config);
                    }
                }
                
                log.info("Loaded {} email configurations for institute", configs.size());
            } else {
                log.info("No EMAIL_CONFIGURATIONS found in institute settings, using defaults");
                configs = getDefaultEmailConfigurations();
            }
        } catch (Exception e) {
            log.error("Error parsing institute email settings", e);
            configs = getDefaultEmailConfigurations();
        }
        
        return configs;
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
            .type("marketing")
            .description("Marketing and promotional emails")
            .build());
            
        // Transactional email
        configs.add(EmailConfigDTO.builder()
            .email("yes@example.com")
            .name("Notifications")
            .type("transactional")
            .description("Transactional and system notifications")
            .build());
            
        // Notifications email
        configs.add(EmailConfigDTO.builder()
            .email("notifications@example.com")
            .name("Institute Notifications")
            .type("notifications")
            .description("General institute notifications")
            .build());
            
        return configs;
    }
    
    /**
     * Get email configuration by specific type
     */
    public EmailConfigDTO getEmailConfigurationByType(String instituteId, String emailType) {
        try {
            List<EmailConfigDTO> allConfigs = getEmailConfigurations(instituteId);
            return allConfigs.stream()
                .filter(config -> emailType.equals(config.getType()))
                .findFirst()
                .orElse(null);
        } catch (Exception e) {
            log.error("Error getting email configuration by type: {} for institute: {}", emailType, instituteId, e);
            return null;
        }
    }
    
    /**
     * Add new email configuration
     */
    public EmailConfigDTO addEmailConfiguration(String instituteId, EmailConfigDTO emailConfig) {
        try {
            // Get current institute settings
            var institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (institute == null) {
                throw new RuntimeException("Institute not found: " + instituteId);
            }
            
            // Parse current settings
            JsonNode settings = objectMapper.readTree(institute.getSetting());
            JsonNode emailConfigs = settings
                .path(NotificationConstants.SETTING)
                .path(NotificationConstants.EMAIL_SETTING)
                .path(NotificationConstants.DATA)
                .path("EMAIL_CONFIGURATIONS");
            
            // Create new configuration node
            JsonNode newConfig = objectMapper.valueToTree(Map.of(
                "email", emailConfig.getEmail(),
                "name", emailConfig.getName(),
                "description", emailConfig.getDescription(),
                "enabled", true
            ));
            
            // Add to existing configurations
            ((com.fasterxml.jackson.databind.node.ObjectNode) emailConfigs).set(emailConfig.getType(), newConfig);
            
            // Update institute settings
            String updatedSettings = objectMapper.writeValueAsString(settings);
            updateInstituteSettings(instituteId, updatedSettings);
            
            log.info("Added email configuration: {} for institute: {}", emailConfig.getType(), instituteId);
            return emailConfig;
            
        } catch (Exception e) {
            log.error("Error adding email configuration for institute: {}", instituteId, e);
            throw new RuntimeException("Failed to add email configuration: " + e.getMessage());
        }
    }
    
    /**
     * Update existing email configuration
     */
    public EmailConfigDTO updateEmailConfiguration(String instituteId, String emailType, EmailConfigDTO emailConfig) {
        try {
            // Get current institute settings
            var institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (institute == null) {
                throw new RuntimeException("Institute not found: " + instituteId);
            }
            
            // Parse current settings
            JsonNode settings = objectMapper.readTree(institute.getSetting());
            JsonNode emailConfigs = settings
                .path(NotificationConstants.SETTING)
                .path(NotificationConstants.EMAIL_SETTING)
                .path(NotificationConstants.DATA)
                .path("EMAIL_CONFIGURATIONS");
            
            // Check if configuration exists
            if (emailConfigs.path(emailType).isMissingNode()) {
                return null; // Configuration not found
            }
            
            // Update configuration
            JsonNode updatedConfig = objectMapper.valueToTree(Map.of(
                "email", emailConfig.getEmail(),
                "name", emailConfig.getName(),
                "description", emailConfig.getDescription(),
                "enabled", true
            ));
            
            ((com.fasterxml.jackson.databind.node.ObjectNode) emailConfigs).set(emailType, updatedConfig);
            
            // Update institute settings
            String updatedSettings = objectMapper.writeValueAsString(settings);
            updateInstituteSettings(instituteId, updatedSettings);
            
            log.info("Updated email configuration: {} for institute: {}", emailType, instituteId);
            return emailConfig;
            
        } catch (Exception e) {
            log.error("Error updating email configuration for institute: {} type: {}", instituteId, emailType, e);
            throw new RuntimeException("Failed to update email configuration: " + e.getMessage());
        }
    }
    
    /**
     * Delete email configuration
     */
    public boolean deleteEmailConfiguration(String instituteId, String emailType) {
        try {
            // Get current institute settings
            var institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (institute == null) {
                throw new RuntimeException("Institute not found: " + instituteId);
            }
            
            // Parse current settings
            JsonNode settings = objectMapper.readTree(institute.getSetting());
            JsonNode emailConfigs = settings
                .path(NotificationConstants.SETTING)
                .path(NotificationConstants.EMAIL_SETTING)
                .path(NotificationConstants.DATA)
                .path("EMAIL_CONFIGURATIONS");
            
            // Check if configuration exists
            if (emailConfigs.path(emailType).isMissingNode()) {
                return false; // Configuration not found
            }
            
            // Remove configuration
            ((com.fasterxml.jackson.databind.node.ObjectNode) emailConfigs).remove(emailType);
            
            // Update institute settings
            String updatedSettings = objectMapper.writeValueAsString(settings);
            updateInstituteSettings(instituteId, updatedSettings);
            
            log.info("Deleted email configuration: {} for institute: {}", emailType, instituteId);
            return true;
            
        } catch (Exception e) {
            log.error("Error deleting email configuration for institute: {} type: {}", instituteId, emailType, e);
            throw new RuntimeException("Failed to delete email configuration: " + e.getMessage());
        }
    }
    
    /**
     * Update institute settings via admin-core-service API
     */
    private void updateInstituteSettings(String instituteId, String updatedSettings) {
        try {
            boolean success = instituteInternalService.updateInstituteSettings(instituteId, updatedSettings);
            if (!success) {
                throw new RuntimeException("Failed to update institute settings via admin-core-service");
            }
            log.info("Successfully updated institute settings for: {}", instituteId);
        } catch (Exception e) {
            log.error("Error updating institute settings for: {}", instituteId, e);
            throw new RuntimeException("Failed to update institute settings: " + e.getMessage());
        }
    }
}
