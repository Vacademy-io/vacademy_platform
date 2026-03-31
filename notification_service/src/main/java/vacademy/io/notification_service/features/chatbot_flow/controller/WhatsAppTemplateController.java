package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.chatbot_flow.dto.WhatsAppTemplateDTO;
import vacademy.io.notification_service.features.chatbot_flow.service.WhatsAppTemplateManagerService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notification-service/v1/whatsapp-templates")
@RequiredArgsConstructor
@Slf4j
public class WhatsAppTemplateController {

    private final WhatsAppTemplateManagerService templateService;

    @PostMapping
    public ResponseEntity<WhatsAppTemplateDTO> createDraft(@RequestBody WhatsAppTemplateDTO dto) {
        log.info("Creating template draft: name={}, institute={}", dto.getName(), dto.getInstituteId());
        return ResponseEntity.ok(templateService.createDraft(dto));
    }

    @GetMapping("/list")
    public ResponseEntity<List<WhatsAppTemplateDTO>> listTemplates(@RequestParam String instituteId) {
        return ResponseEntity.ok(templateService.getAll(instituteId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WhatsAppTemplateDTO> getTemplate(@PathVariable String id) {
        return ResponseEntity.ok(templateService.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WhatsAppTemplateDTO> updateTemplate(
            @PathVariable String id, @RequestBody WhatsAppTemplateDTO dto) {
        log.info("Updating template: id={}", id);
        return ResponseEntity.ok(templateService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable String id) {
        log.info("Deleting template: id={}", id);
        templateService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<WhatsAppTemplateDTO> submitToMeta(@PathVariable String id) {
        log.info("Submitting template to Meta: id={}", id);
        return ResponseEntity.ok(templateService.submitToMeta(id));
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncFromMeta(@RequestParam String instituteId) {
        log.info("Syncing templates from Meta for institute: {}", instituteId);
        int count = templateService.syncFromMeta(instituteId);
        return ResponseEntity.ok(Map.of("synced", count, "instituteId", instituteId));
    }
}
