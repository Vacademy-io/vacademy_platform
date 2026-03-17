package vacademy.io.admin_core_service.features.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateConfigDTO;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

@Service
@Slf4j
public class NotificationConfigService {

    @Autowired
    private NotificationEventConfigRepository notificationEventConfigRepository;

    @Autowired
    private TemplateRepository templateRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Get template configuration for a specific event and institute
     */
    public NotificationTemplateConfigDTO getTemplateConfigByEvent(
            String eventName,
            String instituteId,
            String templateType) {

        try {
            NotificationEventType eventType = NotificationEventType.valueOf(eventName);
            NotificationTemplateType templateTypeEnum = NotificationTemplateType.valueOf(templateType);

            // Find notification event config
            Optional<NotificationEventConfig> configOptional = notificationEventConfigRepository
                    .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                            eventType,
                            NotificationSourceType.INSTITUTE,
                            instituteId,
                            templateTypeEnum);

            if (configOptional.isEmpty()) {
                log.warn("No notification config found for event: {}, institute: {}, type: {}",
                        eventName, instituteId, templateType);
                throw new VacademyException("Notification template configuration not found");
            }

            NotificationEventConfig config = configOptional.get();

            // Fetch template details
            Optional<Template> templateOptional = templateRepository.findById(config.getTemplateId());
            if (templateOptional.isEmpty()) {
                log.error("Template not found for ID: {}", config.getTemplateId());
                throw new VacademyException("Template not found");
            }

            Template template = templateOptional.get();

            // Parse setting_json to extract language_code
            String languageCode = "en"; // default
            try {
                JsonNode settingJson = objectMapper.readTree(template.getSettingJson());
                if (settingJson.has("language_code")) {
                    languageCode = settingJson.get("language_code").asText();
                }
            } catch (Exception e) {
                log.warn("Failed to parse language_code from setting_json, using default: {}", e.getMessage());
            }

            return NotificationTemplateConfigDTO.builder()
                    .templateId(template.getId())
                    .templateName(template.getName())
                    .templateType(template.getType())
                    .languageCode(languageCode)
                    .settingJson(template.getSettingJson())
                    .vendorId(template.getVendorId())
                    .build();

        } catch (IllegalArgumentException e) {
            log.error("Invalid event name or template type: {}", e.getMessage());
            throw new VacademyException("Invalid event name or template type");
        }
    }
}
