package vacademy.io.admin_core_service.features.template.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.template.dto.WhatsAppTemplateDTO;
import vacademy.io.admin_core_service.features.template.service.WhatsAppTemplateService;

@RestController
@RequestMapping("/api/v1/templates")
@Slf4j
public class WhatsAppTemplateController {

    @Autowired
    private WhatsAppTemplateService templateService;

    /**
     * Get WhatsApp template for a specific event and institute
     * 
     * @param eventName   Event name (e.g., "OTP_REQUEST")
     * @param instituteId Institute ID
     * @return WhatsApp template configuration
     */
    @GetMapping("/event/{eventName}/institute/{instituteId}")
    public ResponseEntity<WhatsAppTemplateDTO> getTemplateForEvent(
            @PathVariable String eventName,
            @PathVariable String instituteId) {

        log.info("REST: Fetching template for event: {}, institute: {}", eventName, instituteId);

        try {
            WhatsAppTemplateDTO template = templateService.getTemplateForEvent(eventName, instituteId);
            return ResponseEntity.ok(template);
        } catch (Exception e) {
            log.error("Error fetching template: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Internal endpoint for notification service to fetch WhatsApp template
     * 
     * @param eventName   Event name (e.g., "OTP_REQUEST")
     * @param instituteId Institute ID
     * @return WhatsApp template configuration
     */
    @GetMapping("/internal/whatsapp-template")
    public ResponseEntity<WhatsAppTemplateDTO> getTemplateForEventInternal(
            @RequestParam String eventName,
            @RequestParam String instituteId) {

        log.info("INTERNAL: Fetching template for event: {}, institute: {}", eventName, instituteId);

        try {
            WhatsAppTemplateDTO template = templateService.getTemplateForEvent(eventName, instituteId);
            return ResponseEntity.ok(template);
        } catch (Exception e) {
            log.error("Error fetching template: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
