package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.chatbot_flow.entity.NotificationTemplate;
import vacademy.io.notification_service.features.chatbot_flow.repository.NotificationTemplateRepository;

import java.util.List;
import java.util.Map;

/**
 * Unified template CRUD for all channel types (EMAIL, WHATSAPP, PUSH, SMS).
 * WhatsApp-specific operations (Meta sync, submit) remain in WhatsAppTemplateController.
 */
@RestController
@RequestMapping("/notification-service/v1/templates")
@RequiredArgsConstructor
@Slf4j
public class NotificationTemplateController {

    private final NotificationTemplateRepository templateRepository;

    @PostMapping
    public ResponseEntity<NotificationTemplate> create(@RequestBody NotificationTemplate template) {
        log.info("Creating template: name={}, channel={}, institute={}",
                template.getName(), template.getChannelType(), template.getInstituteId());

        if (template.getChannelType() == null) template.setChannelType("EMAIL");
        if (template.getStatus() == null) template.setStatus("ACTIVE");

        // Check for duplicate name within same institute + channel
        String channelType = template.getChannelType();
        templateRepository.findByInstituteIdAndNameAndChannelType(
                template.getInstituteId(), template.getName(), channelType)
                .ifPresent(existing -> {
                    throw new RuntimeException("Template with name '" + template.getName()
                            + "' already exists for channel " + channelType);
                });

        NotificationTemplate saved = templateRepository.save(template);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/list")
    public ResponseEntity<List<NotificationTemplate>> list(
            @RequestParam String instituteId,
            @RequestParam(required = false) String channelType) {

        List<NotificationTemplate> templates;
        if (channelType != null && !channelType.isEmpty()) {
            templates = templateRepository.findByInstituteIdAndChannelTypeOrderByUpdatedAtDesc(
                    instituteId, channelType.toUpperCase());
        } else {
            templates = templateRepository.findByInstituteIdOrderByUpdatedAtDesc(instituteId);
        }
        return ResponseEntity.ok(templates);
    }

    @GetMapping("/{id}")
    public ResponseEntity<NotificationTemplate> getById(@PathVariable String id) {
        return templateRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<NotificationTemplate> update(
            @PathVariable String id, @RequestBody NotificationTemplate updates) {

        NotificationTemplate existing = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));

        if (updates.getName() != null) existing.setName(updates.getName());
        if (updates.getChannelType() != null) existing.setChannelType(updates.getChannelType());
        if (updates.getSubject() != null) existing.setSubject(updates.getSubject());
        if (updates.getContent() != null) existing.setContent(updates.getContent());
        if (updates.getContentType() != null) existing.setContentType(updates.getContentType());
        if (updates.getBodyText() != null) existing.setBodyText(updates.getBodyText());
        if (updates.getDynamicParameters() != null) existing.setDynamicParameters(updates.getDynamicParameters());
        if (updates.getBodyVariableNames() != null) existing.setBodyVariableNames(updates.getBodyVariableNames());
        if (updates.getStatus() != null) existing.setStatus(updates.getStatus());
        if (updates.getCategory() != null) existing.setCategory(updates.getCategory());
        if (updates.getTemplateCategory() != null) existing.setTemplateCategory(updates.getTemplateCategory());
        if (updates.getSettingJson() != null) existing.setSettingJson(updates.getSettingJson());

        return ResponseEntity.ok(templateRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        NotificationTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));

        if (Boolean.FALSE.equals(template.getCanDelete())) {
            throw new RuntimeException("System template cannot be deleted");
        }

        templateRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get just variable names for a template — used by admin-core for validation.
     */
    @GetMapping("/variables/{templateName}")
    public ResponseEntity<Map<String, Object>> getVariables(
            @PathVariable String templateName,
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "WHATSAPP") String channelType) {

        return templateRepository.findByInstituteIdAndNameAndChannelType(
                        instituteId, templateName, channelType.toUpperCase())
                .map(t -> {
                    Map<String, Object> result = new java.util.HashMap<>();
                    result.put("name", t.getName());
                    result.put("channelType", t.getChannelType());
                    result.put("dynamicParameters", t.getDynamicParameters());
                    result.put("bodyVariableNames", t.getBodyVariableNames());
                    result.put("bodySampleValues", t.getBodySampleValues());
                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
