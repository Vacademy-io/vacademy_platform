package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.telephony.controller.dto.VoiceConfigViewDTO;
import vacademy.io.admin_core_service.features.telephony.core.VoiceCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.core.dto.VoiceCallingSettingsPojo;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Read/save the per-institute Vacademy Voice (Plivo) product configuration —
 * the settings-driven setup the admin dashboard exposes (enable flag, default
 * caller-ID, recording, timezone, compliance status, plan/channels). The Plivo
 * CREDENTIALS stay in the existing telephony config (encrypted); this is the
 * product config envelope (VOICE_CALLING_SETTING). JWT-protected (default auth)
 * + institute-membership validated (instituteId comes from the path — without
 * the check any authenticated user could read/write ANY institute's config).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/voice-config")
@RequiredArgsConstructor
public class VoiceConfigController {

    private final VoiceCallingSettingsService voiceSettings;
    private final InstituteAccessValidator instituteAccessValidator;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    @GetMapping("/{instituteId}")
    public ResponseEntity<VoiceConfigViewDTO> get(
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        VoiceCallingSettingsPojo cfg = voiceSettings.get(instituteId);
        return ResponseEntity.ok(new VoiceConfigViewDTO(
                instituteId, cfg, webhookBase == null ? "" : webhookBase));
    }

    @PutMapping("/{instituteId}")
    public ResponseEntity<VoiceConfigViewDTO> save(
            @PathVariable("instituteId") String instituteId,
            @RequestBody VoiceCallingSettingsPojo pojo,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        // BILLING IS OPS-ONLY: the billing block holds the per-minute credit RATES the
        // call meter charges this institute (CallBillingService). Persisting it from a
        // tenant request would let any institute admin zero their own rates (free
        // calls) or inflate them. Server-side merge: whatever the client sent, the
        // STORED billing block wins — rate overrides change only via a manual DB
        // update on institutes.setting_json (or a future root-admin surface).
        pojo.setBilling(voiceSettings.get(instituteId).getBilling());
        voiceSettings.save(instituteId, pojo);
        return ResponseEntity.ok(new VoiceConfigViewDTO(
                instituteId, voiceSettings.get(instituteId), webhookBase == null ? "" : webhookBase));
    }
}
