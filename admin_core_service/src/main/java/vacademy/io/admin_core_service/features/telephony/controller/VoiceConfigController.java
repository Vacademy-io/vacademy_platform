package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.controller.dto.VoiceConfigViewDTO;
import vacademy.io.admin_core_service.features.telephony.core.VoiceCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.core.dto.VoiceCallingSettingsPojo;

/**
 * Read/save the per-institute Vacademy Voice (Plivo) product configuration —
 * the settings-driven setup the admin dashboard exposes (enable flag, default
 * caller-ID, recording, timezone, compliance status, plan/channels). The Plivo
 * CREDENTIALS stay in the existing telephony config (encrypted); this is the
 * product config envelope (VOICE_CALLING_SETTING). JWT-protected (default auth).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/voice-config")
@RequiredArgsConstructor
public class VoiceConfigController {

    private final VoiceCallingSettingsService voiceSettings;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    @GetMapping("/{instituteId}")
    public ResponseEntity<VoiceConfigViewDTO> get(@PathVariable("instituteId") String instituteId) {
        VoiceCallingSettingsPojo cfg = voiceSettings.get(instituteId);
        return ResponseEntity.ok(new VoiceConfigViewDTO(
                instituteId, cfg, webhookBase == null ? "" : webhookBase));
    }

    @PutMapping("/{instituteId}")
    public ResponseEntity<VoiceConfigViewDTO> save(
            @PathVariable("instituteId") String instituteId,
            @RequestBody VoiceCallingSettingsPojo pojo) {
        voiceSettings.save(instituteId, pojo);
        return ResponseEntity.ok(new VoiceConfigViewDTO(
                instituteId, voiceSettings.get(instituteId), webhookBase == null ? "" : webhookBase));
    }
}
