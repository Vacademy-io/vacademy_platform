package vacademy.io.admin_core_service.features.learner_credentials.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_credentials.dto.LearnerCredentialSendResult;
import vacademy.io.admin_core_service.features.learner_credentials.dto.PasswordResetLinkDTO;
import vacademy.io.admin_core_service.features.learner_credentials.enums.CredentialDeliveryMode;
import vacademy.io.admin_core_service.features.learner_credentials.service.LearnerPasswordResetService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.parent_link.dto.CredentialTemplateConfigDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin-facing endpoints behind "Send Reset Password Email" on a learner's Portal Access panel.
 *
 * <p>Separate from {@code /learner-credentials} because the two actions hand over different
 * things: that one mails an existing username and password, this one mails a link to set a new
 * password and never discloses the current one. They are bound to different events, so an
 * institute can enable one without the other.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/admin-core-service/learner-password-reset/v1")
public class LearnerPasswordResetController {

    private final LearnerPasswordResetService learnerPasswordResetService;

    /**
     * @param mode       DEFAULT (the platform's built-in mail, and any workflow bound to it) or
     *                   TEMPLATE (the institute's own). Defaults to DEFAULT so existing callers
     *                   that omit it behave exactly as before.
     * @param templateId optional one-off template for this send; TEMPLATE mode otherwise uses the
     *                   institute's standing binding
     * @param channels   defaults to EMAIL
     */
    @PostMapping("/send")
    public ResponseEntity<LearnerCredentialSendResult> send(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam String userId,
            @RequestParam(required = false) String packageId,
            @RequestParam(required = false) CredentialDeliveryMode mode,
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) List<NotificationTemplateType> channels) {
        return ResponseEntity.ok(learnerPasswordResetService.send(
                instituteId, userId, packageId, mode, templateId, channels));
    }

    /**
     * The learner's reset link, plus the same link with a {@code {username}} placeholder left in
     * it. The admin copies the first to send by hand and the second to hand to a third-party
     * system that will build these links for its own users.
     */
    @GetMapping("/link")
    public ResponseEntity<PasswordResetLinkDTO> getLink(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam String userId) {
        return ResponseEntity.ok(learnerPasswordResetService.getResetLink(instituteId, userId));
    }

    @GetMapping("/template-config")
    public ResponseEntity<CredentialTemplateConfigDTO> getTemplateConfig(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam NotificationTemplateType channel) {
        return ResponseEntity.ok(learnerPasswordResetService.getTemplateConfig(instituteId, channel));
    }

    @PostMapping("/template-config")
    public ResponseEntity<Void> setTemplateConfig(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam NotificationTemplateType channel,
            @RequestParam String templateId) {
        learnerPasswordResetService.setTemplate(instituteId, channel, templateId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/template-config")
    public ResponseEntity<Void> clearTemplateConfig(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestParam NotificationTemplateType channel) {
        learnerPasswordResetService.clearTemplate(instituteId, channel);
        return ResponseEntity.ok().build();
    }
}
