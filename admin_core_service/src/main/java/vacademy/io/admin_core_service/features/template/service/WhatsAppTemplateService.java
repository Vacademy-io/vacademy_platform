package vacademy.io.admin_core_service.features.template.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.template.dto.WhatsAppTemplateDTO;
import vacademy.io.admin_core_service.features.template.entity.WhatsAppNotificationEventConfig;
import vacademy.io.admin_core_service.features.template.entity.Template;
import vacademy.io.admin_core_service.features.template.repository.WhatsAppNotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.template.repository.WhatsAppTemplateRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class WhatsAppTemplateService {

    @Autowired
    private WhatsAppTemplateRepository templateRepository;

    @Autowired
    private WhatsAppNotificationEventConfigRepository eventConfigRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Get WhatsApp template for a specific event and institute
     * Falls back to DEFAULT institute if no custom template found
     */
    public WhatsAppTemplateDTO getTemplateForEvent(String eventName, String instituteId) {
        log.info("Fetching template for event: {}, institute: {}", eventName, instituteId);

        // Step 1: Try to find institute-specific event configuration
        Optional<WhatsAppNotificationEventConfig> eventConfig = eventConfigRepository
                .findByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActive(
                        eventName, "INSTITUTE", instituteId, "WHATSAPP", true);

        // Step 2: Fallback to default event configuration
        if (eventConfig.isEmpty()) {
            log.info("No custom event config found for institute: {}, using DEFAULT", instituteId);
            eventConfig = eventConfigRepository
                    .findByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActive(
                            eventName, "INSTITUTE", "DEFAULT", "WHATSAPP", true);
        }

        if (eventConfig.isEmpty()) {
            log.error("No event configuration found for event: {}", eventName);
            throw new RuntimeException("No template configuration found for event: " + eventName);
        }

        // Step 3: Fetch template by template_id
        String templateId = eventConfig.get().getTemplateId();
        Optional<Template> template = templateRepository.findById(templateId);

        if (template.isEmpty()) {
            log.error("Template not found with ID: {}", templateId);
            throw new RuntimeException("Template not found: " + templateId);
        }

        // Step 4: Parse setting_json and convert to DTO
        return convertToDTO(template.get());
    }

    /**
     * Convert Template entity to WhatsAppTemplateDTO
     */
    private WhatsAppTemplateDTO convertToDTO(Template template) {
        try {
            WhatsAppTemplateDTO dto = new WhatsAppTemplateDTO();
            dto.setTemplateName(template.getName());

            // Parse setting_json
            JsonNode settingJson = objectMapper.readTree(template.getSettingJson());

            // Extract language code
            String languageCode = settingJson.path("language_code").asText("en");
            dto.setLanguageCode(languageCode);

            // Extract parameters
            WhatsAppTemplateDTO.ParameterConfig paramConfig = new WhatsAppTemplateDTO.ParameterConfig();

            // Body parameters
            JsonNode bodyParams = settingJson.path("parameters").path("body");
            List<WhatsAppTemplateDTO.ParameterMapping> bodyMappings = new ArrayList<>();
            if (bodyParams.isArray()) {
                for (JsonNode param : bodyParams) {
                    WhatsAppTemplateDTO.ParameterMapping mapping = new WhatsAppTemplateDTO.ParameterMapping();
                    mapping.setIndex(param.path("index").asInt());
                    mapping.setSource(param.path("source").asText());
                    mapping.setType(param.path("type").asText("text"));
                    bodyMappings.add(mapping);
                }
            }
            paramConfig.setBody(bodyMappings);

            // Button parameters
            JsonNode buttonParams = settingJson.path("parameters").path("button");
            List<WhatsAppTemplateDTO.ParameterMapping> buttonMappings = new ArrayList<>();
            if (buttonParams.isArray()) {
                for (JsonNode param : buttonParams) {
                    WhatsAppTemplateDTO.ParameterMapping mapping = new WhatsAppTemplateDTO.ParameterMapping();
                    mapping.setIndex(param.path("index").asInt());
                    mapping.setSource(param.path("source").asText());
                    mapping.setType(param.path("type").asText("text"));
                    buttonMappings.add(mapping);
                }
            }
            paramConfig.setButton(buttonMappings);

            dto.setParameterConfig(paramConfig);

            log.info("Successfully converted template: {} to DTO", template.getName());
            return dto;

        } catch (Exception e) {
            log.error("Error parsing template setting_json: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to parse template configuration", e);
        }
    }
}
