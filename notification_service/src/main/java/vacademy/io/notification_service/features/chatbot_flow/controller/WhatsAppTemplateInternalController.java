package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.notification_service.features.chatbot_flow.dto.WhatsAppTemplateDTO;
import vacademy.io.notification_service.features.chatbot_flow.service.WhatsAppTemplateManagerService;

import java.util.Map;

/**
 * Internal (service-to-service) WhatsApp-template lifecycle for the Engagement Engine's D8
 * negotiation state machine in admin_core. It is a thin HMAC-fronted delegation to the existing
 * {@link WhatsAppTemplateManagerService} — no new template logic lives here.
 *
 * SECURITY NOTE: like every "/notification-service/internal/**" path, this is covered by
 * WebSecurityConfig's permitAll (the HmacAuthFilter bean is not wired into the chain), so it is
 * effectively unauthenticated at the server today; admin_core still calls it via
 * InternalClientUtils.makeHmacRequest with signed headers. This is the same posture as
 * EngagementLedgerInternalController — do not add a bespoke one-off check; it is tracked with the
 * service-wide auth cleanup.
 */
@RestController
@RequestMapping("/notification-service/internal/v1/whatsapp-templates")
@RequiredArgsConstructor
@Slf4j
public class WhatsAppTemplateInternalController {

    private final WhatsAppTemplateManagerService templateManager;

    /** Create a DRAFT template row (not yet at Meta). Returns the created template incl. its id. */
    @PostMapping("/draft")
    public ResponseEntity<WhatsAppTemplateDTO> createDraft(@RequestBody WhatsAppTemplateDTO dto) {
        return ResponseEntity.ok(templateManager.createDraft(dto));
    }

    /** Overwrite a DRAFT/REJECTED template (used when a rejected template is edited and re-submitted). */
    @PutMapping("/{id}")
    public ResponseEntity<WhatsAppTemplateDTO> update(@PathVariable String id,
                                                      @RequestBody WhatsAppTemplateDTO dto) {
        return ResponseEntity.ok(templateManager.update(id, dto));
    }

    /** Submit a DRAFT/REJECTED template to Meta for approval. Returns the post-submit status. */
    @PostMapping("/{id}/submit")
    public ResponseEntity<WhatsAppTemplateDTO> submit(@PathVariable String id) {
        return ResponseEntity.ok(templateManager.submitToMeta(id));
    }

    /** Read one template's current status/category/rejection (post-poll reconcile). */
    @GetMapping("/{id}")
    public ResponseEntity<WhatsAppTemplateDTO> getById(@PathVariable String id) {
        return ResponseEntity.ok(templateManager.getById(id));
    }

    /**
     * Look up a template by natural key. Returns the DTO if a non-DELETED row exists, else an empty
     * JSON object {} (200, not 404) so the caller can adopt an orphaned draft after a lost create
     * response without special-casing HTTP error handling.
     */
    @GetMapping("/by-name")
    public ResponseEntity<Object> getByName(@RequestParam String instituteId,
                                            @RequestParam String name,
                                            @RequestParam(required = false, defaultValue = "en") String language) {
        WhatsAppTemplateDTO dto = templateManager.getByNameOrNull(instituteId, name, language);
        return ResponseEntity.ok(dto != null ? dto : java.util.Map.of());
    }

    /** Poll Meta and refresh ALL of this institute's template statuses. Returns {synced}. */
    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> sync(@RequestParam String instituteId) {
        int synced = templateManager.syncFromMeta(instituteId);
        return ResponseEntity.ok(Map.of("synced", synced, "instituteId", instituteId));
    }
}
