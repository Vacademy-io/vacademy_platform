package vacademy.io.admin_core_service.features.notification.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateConfigDTO;
import vacademy.io.admin_core_service.features.notification.service.NotificationConfigService;

@RestController
@RequestMapping("/admin-core-service/internal/v1/notification-config")
@Slf4j
public class NotificationConfigController {

    @Autowired
    private NotificationConfigService notificationConfigService;

    /**
     * Get template configuration by event name, institute ID, and template type
     * This is an internal endpoint called by other services
     */
    @GetMapping("/by-event")
    public ResponseEntity<NotificationTemplateConfigDTO> getTemplateConfigByEvent(
            @RequestParam("event_name") String eventName,
            @RequestParam("institute_id") String instituteId,
            @RequestParam("template_type") String templateType) {

        log.info("Fetching template config for event: {}, institute: {}, type: {}",
                eventName, instituteId, templateType);

        NotificationTemplateConfigDTO config = notificationConfigService.getTemplateConfigByEvent(
                eventName, instituteId, templateType);

        return ResponseEntity.ok(config);
    }
}
