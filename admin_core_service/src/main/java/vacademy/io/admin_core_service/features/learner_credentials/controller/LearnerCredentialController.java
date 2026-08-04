package vacademy.io.admin_core_service.features.learner_credentials.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_credentials.dto.LearnerCredentialSendResult;
import vacademy.io.admin_core_service.features.learner_credentials.service.LearnerCredentialShareService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.parent_link.dto.CredentialTemplateConfigDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin-facing endpoints for sharing a learner's portal credentials and for
 * choosing which template each channel uses.
 *
 * <p>The send action is intentionally separate from the credential UPDATE in
 * auth_service: changing a password and telling the learner about it are
 * different decisions. An admin may rotate a password without notifying, or
 * re-share existing credentials without changing anything.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/admin-core-service/learner-credentials/v1")
public class LearnerCredentialController {

    private final LearnerCredentialShareService learnerCredentialShareService;

    /**
     * Sends the learner's current credentials on each requested channel.
     *
     * @param channels EMAIL and/or WHATSAPP
     */
    @PostMapping("/send")
    public ResponseEntity<LearnerCredentialSendResult> send(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam String userId,
            @RequestParam List<NotificationTemplateType> channels) {
        return ResponseEntity.ok(learnerCredentialShareService.share(instituteId, userId, channels));
    }

    @GetMapping("/template-config")
    public ResponseEntity<CredentialTemplateConfigDTO> getTemplateConfig(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam NotificationTemplateType channel) {
        return ResponseEntity.ok(learnerCredentialShareService.getTemplateConfig(instituteId, channel));
    }

    @PostMapping("/template-config")
    public ResponseEntity<Void> setTemplateConfig(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam NotificationTemplateType channel,
            @RequestParam String templateId) {
        learnerCredentialShareService.setTemplate(instituteId, channel, templateId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/template-config")
    public ResponseEntity<Void> clearTemplateConfig(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam NotificationTemplateType channel) {
        learnerCredentialShareService.clearTemplate(instituteId, channel);
        return ResponseEntity.ok().build();
    }
}
